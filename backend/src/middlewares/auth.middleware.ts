import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const User = require('../models/user.model');
const { resolveAccountType } = require('../config/accountTypes');
const { ensureTenantForUser } = require('../services/tenant.service');
const { isUsableTenantId } = require('../utils/tenantScope');

interface DecodedAccessToken {
    id: string;
    tenantId?: string;
    tokenVersion?: number;
    [key: string]: unknown;
}

interface AuthenticatedUser {
    _id: string;
    isActive?: boolean;
    tokenVersion?: number;
    role?: string;
    accountType?: string;
    employeeId?: string;
    tenantId?: string;
    companyName?: string;
    fullName?: string;
}

declare module 'express-serve-static-core' {
    interface Request {
        userId?: string;
        user?: AuthenticatedUser;
        accountType?: string;
        tenantId?: string | null;
    }
}

const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) { res.status(401).json({ message: "No token provided" }); return; }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedAccessToken;

    const user: AuthenticatedUser | null = await User.findById(decoded.id).select(
      "_id isActive tokenVersion role accountType employeeId tenantId companyName fullName",
    );
    if (!user || user.isActive === false) {
      res.status(401).json({ message: "User not found or deactivated" });
      return;
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      res.status(401).json({ message: "Token is no longer valid" });
      return;
    }

    req.userId = decoded.id;
    req.user = user;
    req.accountType = resolveAccountType(user);

    req.tenantId = user.tenantId
      || (isUsableTenantId(decoded.tenantId) ? decoded.tenantId : null)
      || (await ensureTenantForUser(user));

    next();
} catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }};

export = auth;