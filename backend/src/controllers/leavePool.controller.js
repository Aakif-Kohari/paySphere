/**
 * @fileoverview Leave Pool Controller
 * @description Manages leave donations, catastrophic relief applications,
 * HR approvals, and pool metrics.
 * Issue: #1575
 */

const {
  validateLeaveDonation,
  evaluateReliefGrant,
  calculatePoolMetrics,
  STATUTORY_MINIMUM_RETAINED_DAYS,
} = require('../utils/leavePoolEngine.utils');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

// In-memory or database-backed relief pool stores
const poolDonationRecords = [];
const poolGrantRecords = [];

/**
 * POST /api/leave-pool/donate
 * Submits a leave day donation to the emergency relief pool.
 */
async function donateLeave(req, res, next) {
  try {
    const { donorId, daysToDonate, leaveType = 'Privilege Leave' } = req.body;

    if (!donorId || !daysToDonate) {
      return res.status(400).json({
        success: false,
        message: 'donorId and daysToDonate are required',
      });
    }

    let employee = null;
    try {
      employee = await Employee.findById(donorId);
    } catch {
      // Mock fallback
    }

    const currentBalance = employee?.leaveBalances?.privilegeLeave || 22; // 22 days default
    const validation = validateLeaveDonation(currentBalance, Number(daysToDonate), 0);

    if (!validation.isEligible) {
      return res.status(400).json({
        success: false,
        message: validation.rejectionReason,
      });
    }

    const donationRecord = {
      id: `DON-${Date.now()}`,
      donorId: String(donorId),
      donorName: employee?.fullName || `Employee ${donorId}`,
      days: validation.transferableDays,
      leaveType,
      status: 'APPROVED',
      donatedAt: new Date().toISOString(),
    };

    poolDonationRecords.push(donationRecord);

    return res.status(200).json({
      success: true,
      message: `Successfully donated ${validation.transferableDays} days to the emergency relief pool`,
      data: {
        donation: donationRecord,
        remainingBalance: validation.remainingBalance,
      },
    });
  } catch (error) {
    logger.error('Error donating leave:', error);
    return next(error);
  }
}

/**
 * POST /api/leave-pool/apply-relief
 * Submits an application for emergency relief days.
 */
async function applyRelief(req, res, next) {
  try {
    const { beneficiaryId, requestedDays, reason, medicalCertAttached = true } = req.body;

    if (!beneficiaryId || !requestedDays || !reason) {
      return res.status(400).json({
        success: false,
        message: 'beneficiaryId, requestedDays, and reason are required',
      });
    }

    const metrics = calculatePoolMetrics(poolDonationRecords, poolGrantRecords);
    const evaluation = evaluateReliefGrant(Number(requestedDays), metrics.netAvailableDays);

    const applicationRecord = {
      id: `RELIEF-APP-${Date.now()}`,
      beneficiaryId: String(beneficiaryId),
      requestedDays: Number(requestedDays),
      recommendedDays: evaluation.approvedDays,
      reason,
      medicalCertAttached: Boolean(medicalCertAttached),
      status: 'PENDING_REVIEW',
      submittedAt: new Date().toISOString(),
    };

    return res.status(201).json({
      success: true,
      message: 'Emergency relief request submitted for HR review',
      data: applicationRecord,
    });
  } catch (error) {
    logger.error('Error applying for emergency relief:', error);
    return next(error);
  }
}

/**
 * POST /api/leave-pool/grant-relief
 * HR approval and disbursement of relief days from pool.
 */
async function grantRelief(req, res, next) {
  try {
    const { applicationId, beneficiaryId, grantedDays, approvedBy } = req.body;

    if (!beneficiaryId || !grantedDays) {
      return res.status(400).json({
        success: false,
        message: 'beneficiaryId and grantedDays are required',
      });
    }

    const metrics = calculatePoolMetrics(poolDonationRecords, poolGrantRecords);
    const evaluation = evaluateReliefGrant(Number(grantedDays), metrics.netAvailableDays);

    if (!evaluation.canGrant) {
      return res.status(400).json({
        success: false,
        message: evaluation.rejectionReason,
      });
    }

    const grantRecord = {
      id: `GRANT-${Date.now()}`,
      applicationId: applicationId || `APP-${Date.now()}`,
      beneficiaryId: String(beneficiaryId),
      days: evaluation.approvedDays,
      approvedBy: approvedBy || 'HR_ADMIN',
      status: 'COMPLETED',
      grantedAt: new Date().toISOString(),
    };

    poolGrantRecords.push(grantRecord);

    return res.status(200).json({
      success: true,
      message: `Granted ${evaluation.approvedDays} relief days to employee`,
      data: {
        grant: grantRecord,
        remainingPoolDays: evaluation.remainingPoolDays,
      },
    });
  } catch (error) {
    logger.error('Error granting relief days:', error);
    return next(error);
  }
}

/**
 * GET /api/leave-pool/pool-metrics
 * Fetches total pool days, distributed days, and metrics.
 */
async function getPoolMetrics(req, res, next) {
  try {
    const metrics = calculatePoolMetrics(poolDonationRecords, poolGrantRecords);

    return res.status(200).json({
      success: true,
      data: {
        ...metrics,
        statutoryRetentionFloor: STATUTORY_MINIMUM_RETAINED_DAYS,
        recentDonations: poolDonationRecords.slice(-5),
        recentGrants: poolGrantRecords.slice(-5),
      },
    });
  } catch (error) {
    logger.error('Error fetching pool metrics:', error);
    return next(error);
  }
}

module.exports = {
  donateLeave,
  applyRelief,
  grantRelief,
  getPoolMetrics,
  poolDonationRecords,
  poolGrantRecords,
};
