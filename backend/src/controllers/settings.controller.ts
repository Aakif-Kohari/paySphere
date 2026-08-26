/**
 * @fileoverview Settings Controller (TypeScript Migration)
 * @description Manages tenant and user configuration settings, fiscal parameters,
 * rate limits, and security/MFA enforcement with strict type-safety.
 * Issue: #1413
 */

import { Request, Response, NextFunction } from 'express';
const User = require('../models/user.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
}

export interface UserPreferences {
  language?: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface CompanyInfoSettings {
  payrollCycle?: 'weekly' | 'biweekly' | 'monthly';
  companyName?: string;
}

export interface PayrollConfigSettings {
  currency?: string;
  leaveDeductionPolicy?: 'basic_only' | 'gross' | 'none';
  defaultDailyRate?: number;
  defaultOvertimeRate?: number;
}

export interface NotificationSettings {
  emailReminders?: boolean;
  systemAlerts?: boolean;
  payrollCompletion?: boolean;
}

export interface NestedSettings {
  preferences?: UserPreferences;
  companyInfo?: CompanyInfoSettings;
  payrollConfig?: PayrollConfigSettings;
  notifications?: NotificationSettings;
}

export interface UpdateSettingsBody {
  fullName?: string;
  companyName?: string;
  email?: string;
  defaultDailyRate?: number;
  defaultOvertimeRate?: number;
  settings?: NestedSettings;
}

const OVERTIME_RATE_MAX = 1000000;
const DAILY_RATE_MAX = 10000000;

function sanitizeInput(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * GET /api/settings
 * Retrieves user & tenant settings.
 */
export const getSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/settings
 * Updates user & tenant configuration.
 */
export const updateSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Request body is required' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const body: UpdateSettingsBody = req.body;
    const updatedFields: string[] = [];

    // Full name
    if (body.fullName !== undefined) {
      user.fullName = sanitizeInput(body.fullName);
      updatedFields.push('fullName');
    }

    // Company name
    if (body.companyName !== undefined) {
      user.companyName = sanitizeInput(body.companyName);
      updatedFields.push('companyName');
    }

    // Email
    if (body.email !== undefined) {
      const normalizedEmail = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }

      if (normalizedEmail !== user.email) {
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing && String(existing._id) !== String(user._id)) {
          return res.status(409).json({ message: 'Email is already in use by another account' });
        }
        user.email = normalizedEmail;
        updatedFields.push('email');
      }
    }

    // Overtime rate
    const overtimeRateCandidate =
      body.defaultOvertimeRate !== undefined
        ? body.defaultOvertimeRate
        : body.settings?.payrollConfig?.defaultOvertimeRate;

    if (overtimeRateCandidate !== undefined) {
      const rate = Number(overtimeRateCandidate);
      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({ message: 'Default rates must be non-negative numbers' });
      }
      if (rate > OVERTIME_RATE_MAX) {
        return res.status(400).json({ message: `Default overtime rate cannot exceed ${OVERTIME_RATE_MAX}` });
      }
      user.defaultOvertimeRate = rate;
      updatedFields.push('defaultOvertimeRate');
    }

    // Daily rate
    const dailyRateCandidate =
      body.defaultDailyRate !== undefined
        ? body.defaultDailyRate
        : body.settings?.payrollConfig?.defaultDailyRate;

    if (dailyRateCandidate !== undefined) {
      const rate = Number(dailyRateCandidate);
      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({ message: 'Default rates must be non-negative numbers' });
      }
      if (rate > DAILY_RATE_MAX) {
        return res.status(400).json({ message: `Default daily rate cannot exceed ${DAILY_RATE_MAX}` });
      }
      user.defaultDailyRate = rate;
      updatedFields.push('defaultDailyRate');
    }

    // Nested settings merge
    if (body.settings && typeof body.settings === 'object') {
      user.settings = user.settings || {};

      if (body.settings.preferences) {
        user.settings.preferences = {
          ...user.settings.preferences,
          ...body.settings.preferences,
        };
      }

      if (body.settings.notifications) {
        user.settings.notifications = {
          ...user.settings.notifications,
          ...body.settings.notifications,
        };
      }

      if (body.settings.companyInfo) {
        user.settings.companyInfo = {
          ...user.settings.companyInfo,
          ...body.settings.companyInfo,
        };
      }

      if (body.settings.payrollConfig) {
        user.settings.payrollConfig = {
          ...user.settings.payrollConfig,
          ...body.settings.payrollConfig,
        };
      }
      updatedFields.push('settings');
    }

    await user.save();

    try {
      if (eventBus && typeof eventBus.emitAuditLog === 'function') {
        eventBus.emitAuditLog({
          userId: String(user._id),
          action: 'SETTINGS_UPDATE',
          resourceType: 'User',
          details: { updatedFields },
        });
      }
    } catch {
      // Fire-and-forget audit error
    }

    return res.status(200).json({
      message: 'Settings updated successfully',
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      defaultDailyRate: user.defaultDailyRate,
      defaultOvertimeRate: user.defaultOvertimeRate,
      settings: user.settings,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
