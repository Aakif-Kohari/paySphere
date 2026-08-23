/**
 * @fileoverview Settings Controller (TypeScript Migration)
 * @description Manages tenant and user configuration settings, fiscal parameters,
 * rate limits, and security/MFA enforcement with strict type-safety.
 * Issue: #1413
 */
import { Request, Response, NextFunction } from 'express';
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
/**
 * GET /api/settings
 * Retrieves user & tenant settings.
 */
export declare const getSettings: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response | void>;
/**
 * PATCH /api/settings
 * Updates user & tenant configuration.
 */
export declare const updateSettings: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response | void>;
//# sourceMappingURL=settings.controller.d.ts.map