/**
 * @fileoverview JWT Utility Functions
 * @description Handles the generation and verification of short-lived access tokens
 * and long-lived refresh tokens.
 *
 * Issue: #725
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TOKEN_SECRET: string = process.env.JWT_SECRET || 'default_access_secret';
const REFRESH_TOKEN_SECRET: string = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface AccessTokenPayload {
    id: string;
    tenantId?: string;
    role?: string;
    tokenVersion?: number;
    [key: string]: unknown;
}

function generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'paysphere-api',
    });
}

function generateRefreshTokenString(): string {
    return crypto.randomBytes(64).toString('hex');
}

function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, { issuer: 'paysphere-api' }) as AccessTokenPayload;
}

function getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export {
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    generateAccessToken,
    generateRefreshTokenString,
    verifyAccessToken,
    getRefreshTokenExpiry,
};