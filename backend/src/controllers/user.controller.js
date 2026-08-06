const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const User = require('../models/user.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const { sendEmail } = require('../utils/email');
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const {
  isNonEmptyString,
  isValidEmail,
  sanitizeText,
  DAILY_RATE_MAX,
  OVERTIME_RATE_MAX,
} = require('../utils/validators');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { getDefaultRole } = require('../seeds/rbac.seed');
const { resolveAccountType } = require('../config/accountTypes');
const { ensureTenantForUser } = require('../services/tenant.service');

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '250441239388-ldget7kv1v1hvf6vm1r6b0p48fassv43.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const generateTokens = (user, res) => {
  const accessToken = jwt.sign(
    { id: user._id,
      role: user.role,
      tenantId: user.tenantId, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = jwt.sign(
    { id: user._id,
      role: user.role,
      tenantId: user.tenantId, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return accessToken;
};

// SIGN UP
exports.signup = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { fullName, email, companyName, password } = req.body;

    if (
      !isNonEmptyString(fullName) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(companyName) ||
      !isNonEmptyString(password)
    ) {
      return res.status(400).json({
        message:
          'Full name, email, company name, and password are required non-empty strings',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser)
      return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);

    // Assign the owner role at creation. Without this the account is locked out
    // of every permission-guarded route the moment it is created (#413).
    const defaultRole = await getDefaultRole();

    const newUser = new User({
      fullName: sanitizeText(fullName),
      email: cleanEmail,
      companyName: sanitizeText(companyName),
      password: hashedPassword,
      ...(defaultRole ? { role: defaultRole._id } : {}),
    });

    await newUser.save();

    if (!defaultRole) {
      logger.warn('Signed up a user without a role: RBAC roles are not seeded', {
        userId: newUser._id,
      });
    }

    // Create the company this account is registering, and bind the account to
    // it, *before* the token is minted — `generateTokens` reads `user.tenantId`
    // into the claim, and every scoped query in the backend then filters on it.
    //
    // #585 skipped this step entirely, which is why `Tenant` was imported at
    // the top of this file and never used. The consequence was not that scoped
    // reads returned nothing: mongoose strips `{ tenantId: undefined }` out of a
    // filter, so they returned every company's rows (#612).
    await ensureTenantForUser(newUser);

    const token = generateTokens(newUser, res);

    // `role` here is the *account type* the client renders navigation from, not
    // the RBAC role reference — see config/accountTypes.js (#558).
    res.status(201).json({
      token,
      companyName: newUser.companyName,
      role: resolveAccountType(newUser),
      employeeId: newUser.employeeId,
      currency: newUser.settings?.payrollConfig?.currency || 'INR'
    });
  } catch (error) {
    next(error);
  }
};

// LOGIN
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res
        .status(400)
        .json({ message: 'Email and password are required strings' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid credentials' });

    if (user.isTwoFactorEnabled) {
      return res.status(200).json({
        requires2FA: true,
        userId: user._id,
        message: "Two-Factor Authentication code required",
      });
    }

    // Self-heal on the way in, for accounts that predate #585 or that the
    // boot-time backfill has not reached. A no-op — one indexed read — once the
    // account has a tenant, which is every account created after this change.
    await ensureTenantForUser(user);

    const { generateTokens } = require('../utils/generateToken');
    const token = generateTokens(user, res);

    res.status(200).json({
      token,
      companyName: user.companyName,
      role: resolveAccountType(user),
      employeeId: user.employeeId,
      currency: user.settings?.payrollConfig?.currency || 'INR'
    });
  } catch (error) {
    next(error);
  }
};

// GET USER SETTINGS
exports.getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Scoped by tenant like every other employee read since #585. Left on
    // `createdBy`, this counted only the employees this particular admin had
    // added, and after #585 stopped writing that field it counted zero — the
    // Settings page reported an empty company (#613).
    const employeeCount = await Employee.countDocuments({
      tenantId: req.tenantId,
    });

    res.status(200).json({
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      companyName: user.companyName,
      settings: user.settings,
      defaultOvertimeRate: user.defaultOvertimeRate || 0,
      defaultDailyRate: user.defaultDailyRate || 0,
      isGoogleLinked: !!user.googleId,
      organizationId: user._id.toString(),
      payrollId: 'PR-' + user._id.toString().slice(-6).toUpperCase(),
      employeeCount,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE USER SETTINGS

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });

    // Store as base64 string
    const base64Data = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;
    const logoDataUrl = `data:${mimeType};base64,${base64Data}`;

    await User.findByIdAndUpdate(req.userId, { companyLogoData: logoDataUrl });

    // Also invalidate settings cache if we had one
    res.status(200).json({ message: "Logo updated successfully", logo: logoDataUrl });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    let {
      settings,
      fullName,
      email,
      companyName,
      defaultOvertimeRate,
      defaultDailyRate,
      avatar,
    } = req.body;

    if (settings && settings.payrollConfig) {
      if (defaultDailyRate === undefined && settings.payrollConfig.defaultDailyRate !== undefined) {
        defaultDailyRate = Number(settings.payrollConfig.defaultDailyRate);
      }
      if (defaultOvertimeRate === undefined && settings.payrollConfig.defaultOvertimeRate !== undefined) {
        defaultOvertimeRate = Number(settings.payrollConfig.defaultOvertimeRate);
      }
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (
      (defaultOvertimeRate !== undefined &&
        (typeof defaultOvertimeRate !== 'number' ||
          isNaN(defaultOvertimeRate) ||
          defaultOvertimeRate < 0)) ||
      (defaultDailyRate !== undefined &&
        (typeof defaultDailyRate !== 'number' ||
          isNaN(defaultDailyRate) ||
          defaultDailyRate < 0))
    ) {
      return res
        .status(400)
        .json({ message: 'Default rates must be non-negative numbers' });
    }

    if (
      defaultOvertimeRate !== undefined &&
      defaultOvertimeRate > OVERTIME_RATE_MAX
    ) {
      return res.status(400).json({
        message: `Default overtime rate cannot exceed ${OVERTIME_RATE_MAX}`,
      });
    }
    if (defaultDailyRate !== undefined && defaultDailyRate > DAILY_RATE_MAX) {
      return res.status(400).json({
        message: `Default daily rate cannot exceed ${DAILY_RATE_MAX}`,
      });
    }

    if (fullName) user.fullName = sanitizeText(fullName);

    if (email !== undefined) {
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res
          .status(400)
          .json({ message: 'Invalid email address format' });
      }
      if (cleanEmail !== user.email) {
        const emailExists = await User.findOne({ email: cleanEmail });
        if (emailExists) {
          return res
            .status(409)
            .json({ message: 'Email is already in use by another account' });
        }
        user.email = cleanEmail;
      }
    }

    if (companyName) user.companyName = sanitizeText(companyName);
    if (defaultOvertimeRate !== undefined)
      user.defaultOvertimeRate = defaultOvertimeRate;
    if (defaultDailyRate !== undefined)
      user.defaultDailyRate = defaultDailyRate;
    if (avatar !== undefined) user.avatar = avatar;

    if (!user.settings) user.settings = {};

    if (settings) {
      if (settings.preferences) {
        user.settings.preferences = {
          ...(user.settings.preferences || {}),
          ...settings.preferences,
        };
      }
      if (settings.companyInfo) {
        user.settings.companyInfo = {
          ...(user.settings.companyInfo || {}),
          ...settings.companyInfo,
        };
      }
      if (settings.payrollConfig) {
        user.settings.payrollConfig = {
          ...(user.settings.payrollConfig || {}),
          ...settings.payrollConfig,
        };
      }
      if (settings.notifications) {
        user.settings.notifications = {
          ...(user.settings.notifications || {}),
          ...settings.notifications,
        };
      }
    }

    await user.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'User',
      details: { updatedFields: Object.keys(req.body) },
      req,
    });

    logger.info(`Settings updated`, {
      userId: req.userId,
      fields: Object.keys(req.body),
    });

    res.status(200).json({
      message: 'Settings updated successfully',
      settings: user.settings,
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      avatar: user.avatar,
      defaultOvertimeRate: user.defaultOvertimeRate,
      defaultDailyRate: user.defaultDailyRate,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE PASSWORD
exports.updatePassword = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      return res
        .status(400)
        .json({ message: 'Current password and new password are required' });
    }

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
      });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: 'No password set. Please use password recovery.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect current password' });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'PASSWORD_UPDATE',
      resourceType: 'User',
      details: {},
      req,
    });

    logger.info(`Password updated`, { userId: req.userId });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
// GOOGLE AUTH
exports.googleAuth = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { credential, accessToken, companyName } = req.body;
    let googleData;

    if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      googleData = ticket.getPayload();
    } else if (accessToken) {
      const tokenInfoResponse = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
      );
      const tokenInfo = tokenInfoResponse.data;

      if (
        tokenInfo.aud !== GOOGLE_CLIENT_ID &&
        tokenInfo.azp !== GOOGLE_CLIENT_ID
      ) {
        return res
          .status(401)
          .json({ message: 'Invalid Google access token: audience mismatch' });
      }

      const userInfoResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      googleData = userInfoResponse.data;
    } else {
      return res
        .status(400)
        .json({ message: 'No Google credentials provided' });
    }

    const { sub: googleId, email, name, picture } = googleData;

    let user = await User.findOne({ email });
    const isNewUser = !user;

    if (!user) {
      if (!companyName) {
        return res.status(202).json({
          message:
            "Account doesn't exist. Please provide a company name to sign up.",
          needsCompanyName: true,
        });
      }

      // Same as the password signup path: a Google-registered owner needs the
      // default role or they are locked out of the app they just created (#413).
      const defaultRole = await getDefaultRole();

      user = new User({
        fullName: sanitizeText(name),
        email,
        companyName: sanitizeText(companyName),
        googleId: googleId || googleData.sub,
        avatar: picture || googleData.picture,
        ...(defaultRole ? { role: defaultRole._id } : {}),
      });

      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId || googleData.sub;
      user.avatar = picture || googleData.picture;
      await user.save();
    }

    // Same as the password paths: provision on registration, self-heal on
    // return. Google sign-in is a first-class way to create a company here, so
    // it needs a tenant just as much as `signup` does (#612).
    await ensureTenantForUser(user);

    const token = generateTokens(user, res);

    const statusCode = isNewUser ? 201 : 200;
    res.status(statusCode).json({
      token,
      companyName: user.companyName,
      role: resolveAccountType(user),
      employeeId: user.employeeId,
      currency: user.settings?.payrollConfig?.currency || 'INR',
      message: isNewUser
        ? 'Account created successfully'
        : 'Logged in successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Local Map to store cooldowns for password reset requests (5 minutes per email)
const resetCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

// Periodically clean up expired cooldown entries to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS;
  for (const [email, timestamp] of resetCooldowns) {
    if (timestamp < cutoff) resetCooldowns.delete(email);
  }
}, 60 * 1000);

// FORGOT PASSWORD
exports.forgotPassword = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { email } = req.body;
    if (!isNonEmptyString(email) || !isValidEmail(email)) {
      return res
        .status(400)
        .json({ message: 'A valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check cooldown for this email (5 minutes)
    const lastRequest = resetCooldowns.get(cleanEmail);
    if (lastRequest && Date.now() - lastRequest < COOLDOWN_MS) {
      // Still in cooldown period, return generic message without sending email
      return res.status(200).json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Update cooldown
    resetCooldowns.set(cleanEmail, Date.now());

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(200).json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Set token and expiry (1 hour)
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // Reset link pointing to frontend — always use server-side config,
    // never the user-controlled Origin header (prevents token hijacking)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const text =
      `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`;

    const html =
      `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>` +
      `<p>Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:</p>` +
      `<p><a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a></p>` +
      `<p>If you cannot click the button, copy and paste the link below into your browser:</p>` +
      `<p>${resetUrl}</p>` +
      `<hr/>` +
      `<p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    await sendEmail({
      to: user.email,
      subject: 'PaySphere Password Reset Link',
      text,
      html,
    });

    res.status(200).json({
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { password } = req.body;

    if (!isNonEmptyString(password) || !passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Password reset token is invalid or has expired' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Save user new password, clear token fields, and increment tokenVersion
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

// DISCONNECT GOOGLE
exports.disconnectGoogle = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.password) {
      return res.status(400).json({
        message:
          'You must set a password before disconnecting your Google account.',
      });
    }

    user.googleId = undefined;
    await user.save();

    res
      .status(200)
      .json({ message: 'Google account disconnected successfully.' });
  } catch (error) {
    next(error);
  }
};

// DELETE ACCOUNT
exports.deleteAccount = async (req, res, next) => {
  let session = null;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'No password set on this account' });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(403).json({ message: 'Current password is incorrect' });
    }

    // Try to start a transaction (gracefully fallback if not supported)
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    const deleteOptions = session ? { session } : {};

    const AuditLog = require('../models/auditLog.model');

    // Scoped by tenant: these rows are the company's, and since #585 they no
    // longer carry a `createdBy` to match on. Filtering by the old key deleted
    // nothing and left the company's employee and payroll records behind after
    // the account that owned them was gone (#613).
    await Employee.deleteMany({ tenantId: req.tenantId }, deleteOptions);
    await PayrollUpdate.deleteMany({ tenantId: req.tenantId }, deleteOptions);
    await AuditLog.deleteMany({ userId: req.userId }, deleteOptions);
    await User.findByIdAndDelete(req.userId, deleteOptions);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'ACCOUNT_DELETE',
      resourceType: 'User',
      details: {},
      req,
    });

    logger.info(`Account deleted`, { userId: req.userId });

    res
      .status(200)
      .json({ message: 'Account and associated data deleted successfully.' });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch {
        // ignore session cleanup error
      }
    }
    next(error);
  }
};

// REFRESH TOKEN
exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken)
      return res.status(401).json({ message: 'No refresh token provided' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ message: 'Invalid or expired refresh token' });
    }

    // `role`, `tenantId`, `companyName` and `employeeId` are selected because
    // `generateTokens` reads all four into the claim. The projection used to
    // stop at `tokenVersion`, so every refresh minted a token carrying
    // `role: undefined, tenantId: undefined` — a session lost its tenant fifteen
    // minutes after logging in, whatever `login` had put there (#612).
    const user = await User.findById(decoded.id).select(
      '_id isActive tokenVersion role tenantId companyName fullName employeeId',
    );
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({ message: 'Token is no longer valid' });
    }

    await ensureTenantForUser(user);

    const token = generateTokens(user, res);
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};

// LOGOUT
exports.logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
          ignoreExpiration: true,
        });
        if (decoded && decoded.id) {
          await User.findByIdAndUpdate(decoded.id, {
            $inc: { tokenVersion: 1 },
          });
        }
      } catch {
        // Ignore token verification errors during logout
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};
// GENERATE 2FA QR CODE & SECRET
exports.generate2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      `PaySphere (${user.companyName || "Admin"})`,
      secret
    );

    user.twoFactorSecret = secret;
    await user.save();

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return res.status(200).json({
      secret,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    next(error);
  }
};

// VERIFY & ENABLE 2FA
exports.verifyAndEnable2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "2FA token code is required" });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: "2FA is not initialized" });
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: "Invalid 2FA verification code" });
    }

    user.isTwoFactorEnabled = true;
    await user.save();

    return res.status(200).json({
      message: "Two-Factor Authentication successfully enabled",
      isTwoFactorEnabled: true,
    });
  } catch (error) {
    next(error);
  }
};

// DISABLE 2FA
exports.disable2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.userId);

    if (!user || !user.isTwoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not currently enabled" });
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: "Invalid 2FA verification code" });
    }

    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = "";
    await user.save();

    return res.status(200).json({
      message: "Two-Factor Authentication disabled",
      isTwoFactorEnabled: false,
    });
  } catch (error) {
    next(error);
  }
};

// VALIDATE 2FA ON LOGIN
exports.validate2FALogin = async (req, res, next) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ message: "User ID and 2FA token are required" });
    }

    const user = await User.findById(userId);
    if (!user || !user.isTwoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this user" });
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({ message: "Invalid 2FA code" });
    }

    // Generate full JWT access token after successful 2FA
    const accessToken = generateTokens(user, res);

    return res.status(200).json({
      message: "2FA verification successful",
      token: accessToken,
      user: {
        id: user._id,
      role: user.role,
      tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
      },
    });
  } catch (error) {
    next(error);
  }
};