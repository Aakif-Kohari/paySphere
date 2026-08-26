const crypto = require('crypto');
const TeamInvite = require('../models/teamInvite.model');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const { createAuditLog } = require('./audit.service');
const emailService = require('./email.service');
const logger = require('../utils/logger');

/**
 * Generate a secure team invite and dispatch email
 */
exports.generateInvite = async (tenantId, inviterId, email, roleId) => {
  // Validate role
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error('Invalid role specified');
  }

  // Check if user already exists and belongs to this tenant
  const existingUser = await User.findOne({ email });
  if (existingUser && existingUser.tenantId && existingUser.tenantId.toString() === tenantId.toString()) {
    throw new Error('User is already a member of this workspace');
  }

  // Check for existing pending invite
  let pendingInvite = await TeamInvite.findOne({ tenantId, email, status: 'pending' });
  if (pendingInvite) {
    // We could revoke and reissue, or throw
    pendingInvite.status = 'revoked';
    await pendingInvite.save();
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const invite = await TeamInvite.create({
    tenantId,
    inviterId,
    email,
    role: roleId,
    token,
    expiresAt,
  });

  const inviter = await User.findById(inviterId);
  const inviterName = inviter ? inviter.fullName : 'A team member';

  await emailService.sendTeamInviteEmail(email, token, inviterName, role.name);

  await createAuditLog({
    userId: inviterId,
    tenantId,
    action: 'TEAM_INVITE_SENT',
    resourceType: 'TeamInvite',
    resourceIds: [invite._id],
    details: { email, role: role.name },
  });

  return invite;
};

/**
 * Validate a team invite token
 */
exports.validateToken = async (token) => {
  const invite = await TeamInvite.findOne({ token, status: 'pending' }).populate('role', 'name');
  if (!invite) {
    throw new Error('Invalid or expired invite link');
  }
  if (invite.expiresAt < new Date()) {
    invite.status = 'revoked';
    await invite.save();
    throw new Error('Invite link has expired');
  }
  return invite;
};

/**
 * Accept a team invite
 */
exports.acceptInvite = async (token, userId) => {
  const invite = await this.validateToken(token);
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Associate user with tenant
  user.tenantId = invite.tenantId;
  user.role = invite.role._id;
  user.accountType = 'employer'; // Assuming invited users are employer side
  await user.save();

  invite.status = 'accepted';
  await invite.save();

  await createAuditLog({
    userId,
    tenantId: invite.tenantId,
    action: 'TEAM_INVITE_ACCEPTED',
    resourceType: 'TeamInvite',
    resourceIds: [invite._id],
    details: { email: invite.email },
  });

  return user;
};

/**
 * Deactivate a team member
 */
exports.deactivateMember = async (tenantId, memberId, actionUserId) => {
  const member = await User.findOne({ _id: memberId, tenantId });
  if (!member) {
    throw new Error('Member not found in this workspace');
  }

  const role = await Role.findById(member.role);
  if (role && role.name === 'OWNER') {
    // Basic protection. Should ideally check if they are the LAST owner.
    // For now, prevent deactivating any owner.
    throw new Error('Cannot deactivate a workspace owner');
  }

  // Invalidate JWTs
  member.tokenVersion += 1;
  member.isActive = false;
  await member.save();

  await createAuditLog({
    userId: actionUserId,
    tenantId,
    action: 'TEAM_MEMBER_DEACTIVATED',
    resourceType: 'User',
    resourceIds: [member._id],
    details: { deactivatedEmail: member.email },
  });

  return member;
};

/**
 * Revoke an invite
 */
exports.revokeInvite = async (tenantId, inviteId, actionUserId) => {
  const invite = await TeamInvite.findOne({ _id: inviteId, tenantId, status: 'pending' });
  if (!invite) {
    throw new Error('Pending invite not found');
  }

  invite.status = 'revoked';
  await invite.save();

  await createAuditLog({
    userId: actionUserId,
    tenantId,
    action: 'TEAM_INVITE_REVOKED',
    resourceType: 'TeamInvite',
    resourceIds: [invite._id],
    details: { email: invite.email },
  });

  return invite;
};
