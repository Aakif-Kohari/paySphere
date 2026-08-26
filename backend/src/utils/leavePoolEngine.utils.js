/**
 * @fileoverview Leave Donation & Catastrophic Relief Pool Engine
 * @description Manages peer-to-peer leave day donations, statutory minimum balance
 * safeguards (Factories Act / S&E Act), emergency medical relief requests, and pool auditing.
 * Issue: #1575
 */

const STATUTORY_MINIMUM_RETAINED_DAYS = 12; // Statutory minimum leave balance required to be retained by donor
const MAX_ANNUAL_DONATION_DAYS = 10;        // Maximum days an employee can donate per calendar year
const MAX_EMERGENCY_GRANT_DAYS = 30;        // Maximum relief days granted per catastrophic medical request

/**
 * Validates whether an employee is eligible to donate leave days to the emergency relief pool.
 *
 * @param {number} currentLeaveBalance - Current accrued Earned/Privilege Leave balance
 * @param {number} daysToDonate - Number of days the employee wishes to donate
 * @param {number} ytdDonatedDays - Days already donated by employee in current year
 * @param {number} statutoryFloor - Statutory minimum leave balance required
 * @returns {{ isEligible: boolean, transferableDays: number, remainingBalance: number, rejectionReason: string|null }}
 */
function validateLeaveDonation(
  currentLeaveBalance = 0,
  daysToDonate = 0,
  ytdDonatedDays = 0,
  statutoryFloor = STATUTORY_MINIMUM_RETAINED_DAYS,
) {
  const balance = Math.max(0, Number(currentLeaveBalance) || 0);
  const requested = Math.max(0, Number(daysToDonate) || 0);
  const ytd = Math.max(0, Number(ytdDonatedDays) || 0);

  if (requested <= 0) {
    return {
      isEligible: false,
      transferableDays: 0,
      remainingBalance: balance,
      rejectionReason: 'Donated leave days must be greater than zero',
    };
  }

  // Check annual donation cap
  const permissibleByCap = Math.max(0, MAX_ANNUAL_DONATION_DAYS - ytd);
  if (permissibleByCap <= 0) {
    return {
      isEligible: false,
      transferableDays: 0,
      remainingBalance: balance,
      rejectionReason: `Annual donation limit of ${MAX_ANNUAL_DONATION_DAYS} days reached`,
    };
  }

  // Check statutory retention floor
  const surplusBalance = Math.max(0, balance - statutoryFloor);
  if (surplusBalance <= 0) {
    return {
      isEligible: false,
      transferableDays: 0,
      remainingBalance: balance,
      rejectionReason: `Statutory compliance requires retaining at least ${statutoryFloor} leave days`,
    };
  }

  const transferableDays = Math.min(requested, permissibleByCap, surplusBalance);
  const isEligible = transferableDays > 0;
  const remainingBalance = balance - transferableDays;

  return {
    isEligible,
    transferableDays,
    remainingBalance,
    rejectionReason: isEligible ? null : 'Insufficient surplus balance above statutory minimum',
  };
}

/**
 * Evaluates an emergency relief grant request against the available pool balance and policies.
 *
 * @param {number} requestedDays - Emergency relief days requested by distressed employee
 * @param {number} availablePoolDays - Currently unallocated days in the emergency bank
 * @param {number} maxGrantLimit - Maximum grant limit per request
 * @returns {{ canGrant: boolean, approvedDays: number, remainingPoolDays: number, rejectionReason: string|null }}
 */
function evaluateReliefGrant(
  requestedDays = 0,
  availablePoolDays = 0,
  maxGrantLimit = MAX_EMERGENCY_GRANT_DAYS,
) {
  const requested = Math.max(0, Number(requestedDays) || 0);
  const pool = Math.max(0, Number(availablePoolDays) || 0);

  if (requested <= 0) {
    return {
      canGrant: false,
      approvedDays: 0,
      remainingPoolDays: pool,
      rejectionReason: 'Requested relief days must be greater than zero',
    };
  }

  if (pool <= 0) {
    return {
      canGrant: false,
      approvedDays: 0,
      remainingPoolDays: 0,
      rejectionReason: 'Emergency leave pool balance is exhausted',
    };
  }

  const approvedDays = Math.min(requested, maxGrantLimit, pool);
  const canGrant = approvedDays > 0;
  const remainingPoolDays = pool - approvedDays;

  return {
    canGrant,
    approvedDays,
    remainingPoolDays,
    rejectionReason: canGrant ? null : 'Unable to allocate relief days from pool',
  };
}

/**
 * Computes live metrics and accounting ledger for the catastrophic leave pool.
 */
function calculatePoolMetrics(donations = [], grants = []) {
  let totalDonatedDays = 0;
  let totalGrantedDays = 0;
  const uniqueDonors = new Set();
  const uniqueBeneficiaries = new Set();

  for (const d of donations) {
    if (d.status === 'COMPLETED' || d.status === 'APPROVED') {
      totalDonatedDays += Number(d.days) || 0;
      if (d.donorId) uniqueDonors.add(String(d.donorId));
    }
  }

  for (const g of grants) {
    if (g.status === 'COMPLETED' || g.status === 'APPROVED') {
      totalGrantedDays += Number(g.days) || 0;
      if (g.beneficiaryId) uniqueBeneficiaries.add(String(g.beneficiaryId));
    }
  }

  const netAvailableDays = Math.max(0, totalDonatedDays - totalGrantedDays);

  return {
    totalDonatedDays,
    totalGrantedDays,
    netAvailableDays,
    activeDonorCount: uniqueDonors.size,
    beneficiaryCount: uniqueBeneficiaries.size,
  };
}

module.exports = {
  STATUTORY_MINIMUM_RETAINED_DAYS,
  MAX_ANNUAL_DONATION_DAYS,
  MAX_EMERGENCY_GRANT_DAYS,
  validateLeaveDonation,
  evaluateReliefGrant,
  calculatePoolMetrics,
};
