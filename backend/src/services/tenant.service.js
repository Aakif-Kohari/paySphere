/**
 * @fileoverview Multi-Tenant Database Connection Pooling & Provisioning Service
 * @description Provides tenant provisioning, dynamic connection pool management per tenant,
 * database isolation, and connection lifecycle management to enforce GDPR/HIPAA tenant isolation.
 */

'use strict';

const mongoose = require('mongoose');
const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// Idle connection cleanup timeout (15 minutes)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

class TenantConnectionPool {
  constructor() {
    this.pools = new Map();
  }

  /**
   * Get or create an isolated Mongoose connection for a specific tenant.
   *
   * @param {string} tenantId Unique tenant identifier
   * @param {string} [customUri] Optional tenant-specific MongoDB connection URI
   * @returns {Promise<mongoose.Connection>}
   */
  async getConnection(tenantId, customUri) {
    const key = String(tenantId);

    if (this.pools.has(key)) {
      const entry = this.pools.get(key);
      entry.lastUsed = Date.now();
      return entry.connection;
    }

    const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017/paysphere';
    const tenantUri = customUri || `${baseUri}_tenant_${key}`;

    logger.info(`Establishing dynamic isolated database connection for tenant`, {
      tenantId: key,
      uri: tenantUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
    });

    const connection = mongoose.createConnection(tenantUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });

    await connection.asPromise();

    const poolEntry = {
      connection,
      tenantId: key,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      timer: setInterval(() => this._cleanupIdlePools(), IDLE_TIMEOUT_MS),
    };

    // Unref timer so process exits cleanly if needed
    if (poolEntry.timer.unref) poolEntry.timer.unref();

    this.pools.set(key, poolEntry);
    return connection;
  }

  /**
   * Periodically close idle tenant connections that haven't been accessed.
   */
  _cleanupIdlePools() {
    const now = Date.now();
    for (const [key, entry] of this.pools.entries()) {
      if (now - entry.lastUsed >= IDLE_TIMEOUT_MS) {
        logger.info(`Closing idle database connection pool for tenant`, { tenantId: key });
        clearInterval(entry.timer);
        entry.connection.close().catch((err) => {
          logger.warn(`Failed to close tenant pool cleanly`, { tenantId: key, error: err.message });
        });
        this.pools.delete(key);
      }
    }
  }

  /**
   * Get current pool metrics.
   * @returns {{activePoolsCount: number, tenants: string[]}}
   */
  getPoolStats() {
    return {
      activePoolsCount: this.pools.size,
      tenants: Array.from(this.pools.keys()),
    };
  }

  /**
   * Close all active connection pools (shutdown helper).
   */
  async closeAll() {
    for (const [key, entry] of this.pools.entries()) {
      clearInterval(entry.timer);
      await entry.connection.close();
    }
    this.pools.clear();
  }
}

const tenantPoolManager = new TenantConnectionPool();

/**
 * The tenant an employee-portal login belongs to.
 */
async function resolveEmployerTenant(user) {
  const employee = await Employee.findById(user.employeeId)
    .select('tenantId createdBy')
    .lean();

  if (!employee) return null;
  if (employee.tenantId) return employee.tenantId;
  if (!employee.createdBy) return null;

  const owner = await User.findById(employee.createdBy).select('tenantId').lean();

  return owner?.tenantId || null;
}

/**
 * Find or create the tenant for an owner account.
 */
async function findOrCreateTenantForOwner(user) {
  const existing = await Tenant.findOne({ ownerId: user._id });
  if (existing) return existing;

  try {
    return await Tenant.create({
      name: user.companyName || user.fullName || 'Unnamed company',
      ownerId: user._id,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return await Tenant.findOne({ ownerId: user._id });
    }
    throw error;
  }
}

/**
 * Give user a tenant if it does not have one, and return the id.
 */
async function ensureTenantForUser(user) {
  if (!user || !user._id) return null;
  if (user.tenantId) return user.tenantId;

  try {
    const tenantId = user.employeeId
      ? await resolveEmployerTenant(user)
      : (await findOrCreateTenantForOwner(user))?._id || null;

    if (!tenantId) {
      logger.warn('Could not resolve a tenant for account', {
        userId: String(user._id),
        employeeId: user.employeeId ? String(user.employeeId) : undefined,
      });
      return null;
    }

    await User.updateOne({ _id: user._id }, { $set: { tenantId } });
    user.tenantId = tenantId;

    logger.info('Provisioned tenant for account', {
      userId: String(user._id),
      tenantId: String(tenantId),
    });

    return tenantId;
  } catch (error) {
    logger.error('Tenant provisioning failed', {
      userId: String(user._id),
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  ensureTenantForUser,
  findOrCreateTenantForOwner,
  resolveEmployerTenant,
  tenantPoolManager,
};
