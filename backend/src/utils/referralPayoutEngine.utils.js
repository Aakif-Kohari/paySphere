/**
 * @fileoverview Referral Payout & Milestone Vesting Engine
 * @description Evaluates candidate probation gating, multi-stage milestone splits,
 * retention safeguards, and payroll bonus dispatch.
 */

'use strict';

const { ReferralCandidate, ReferralPayout } = require('../models/referral.model');
const Employee = require('../models/employee.model');
const logger = require('./logger');

/**
 * Pure function to evaluate milestone vesting for a candidate and program.
 *
 * @param {object} candidate - { status, hiredAt, isActive, probationEndDate }
 * @param {object} program - { bountyAmount, milestoneSplits: [{ label, percentage, trigger }] }
 * @param {Date|string} [asOfDate=new Date()]
 * @returns {object}
 */
function evaluateReferralMilestoneVesting(candidate = {}, program = {}, asOfDate = new Date()) {
  const asOf = new Date(asOfDate);
  const bountyAmount = Number(program.bountyAmount || 0);
  const splits = Array.isArray(program.milestoneSplits) && program.milestoneSplits.length > 0
    ? program.milestoneSplits
    : [
      { label: 'Joining Tranche', percentage: 50, trigger: 'HIRED' },
      { label: 'Probation Completion Tranche', percentage: 50, trigger: 'PROBATION_COMPLETE' },
    ];

  let vestedAmount = 0;
  let pendingAmount = 0;
  let forfeitedAmount = 0;

  const milestones = splits.map((split) => {
    const percentage = Number(split.percentage || 0);
    const amount = Math.round(((bountyAmount * percentage) / 100) * 100) / 100;
    let status = 'Pending';
    let reason = '';

    if (candidate.status !== 'Hired') {
      status = 'Pending';
      pendingAmount += amount;
    } else if (candidate.isActive === false) {
      // Early departure forfeit
      status = 'Forfeited';
      reason = 'Referred candidate is no longer active.';
      forfeitedAmount += amount;
    } else if (split.trigger === 'HIRED') {
      status = 'Vested';
      vestedAmount += amount;
    } else if (split.trigger === 'PROBATION_COMPLETE') {
      if (!candidate.probationEndDate || asOf >= new Date(candidate.probationEndDate)) {
        status = 'Vested';
        vestedAmount += amount;
      } else {
        status = 'Pending';
        pendingAmount += amount;
      }
    } else {
      status = 'Pending';
      pendingAmount += amount;
    }

    return {
      label: split.label,
      percentage,
      amount,
      status,
      reason,
    };
  });

  return {
    totalBounty: bountyAmount,
    vestedAmount: Math.round(vestedAmount * 100) / 100,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
    forfeitedAmount: Math.round(forfeitedAmount * 100) / 100,
    milestones,
  };
}

/**
 * Formats approved referral payouts into payroll addition line items.
 *
 * @param {Array<object>} payouts
 * @returns {Array<object>}
 */
function generateReferralPayrollLineItems(payouts = []) {
  return payouts
    .filter((p) => p && p.status === 'Approved')
    .map((p) => ({
      employeeId: p.referrerId,
      component: 'Referral Bonus',
      amount: Number(p.amount || 0),
      isTaxable: true,
      milestoneLabel: p.milestoneLabel,
      candidateId: p.candidateId,
    }));
}

/**
 * Checks if a referred employee has completed their probation period.
 */
async function checkProbationStatus(employeeId) {
  const employee = await Employee.findById(employeeId).select('probationEndDate isActive');
  if (!employee) return { completed: false, endDate: null };

  const now = new Date();
  if (!employee.probationEndDate) return { completed: true, endDate: null };

  return {
    completed: now >= new Date(employee.probationEndDate),
    endDate: employee.probationEndDate,
  };
}

/**
 * Scans all "Hired" referrals and processes pending milestone payouts.
 */
async function processMilestonePayouts(tenantId) {
  const hiredReferrals = await ReferralCandidate.find({
    tenantId,
    status: 'Hired',
    hiredEmployeeId: { $ne: null },
  }).populate('hiredEmployeeId', 'fullName isActive probationEndDate');

  let processedCount = 0;
  let forfeitedCount = 0;

  for (const referral of hiredReferrals) {
    const pendingPayouts = await ReferralPayout.find({
      tenantId,
      candidateId: referral._id,
      status: 'Pending',
    });

    if (pendingPayouts.length === 0) continue;

    const referredEmp = referral.hiredEmployeeId;
    if (!referredEmp || !referredEmp.isActive) {
      for (const payout of pendingPayouts) {
        payout.status = 'Forfeited';
        payout.forfeitureReason = 'Referred employee is no longer active.';
        await payout.save();
        forfeitedCount++;
      }
      continue;
    }

    const probStatus = await checkProbationStatus(referral.hiredEmployeeId);

    for (const payout of pendingPayouts) {
      if (
        payout.milestoneLabel.toLowerCase().includes('probation') ||
        payout.milestoneLabel.toLowerCase().includes('retention')
      ) {
        if (probStatus.completed) {
          payout.status = 'Approved';
          payout.processedAt = new Date();
          await payout.save();
          processedCount++;
          logger.info(`[Referral] Approved retention bonus for ${referral.referrerId}`);
        }
      } else if (payout.status === 'Pending') {
        payout.status = 'Approved';
        payout.processedAt = new Date();
        await payout.save();
        processedCount++;
      }
    }
  }

  return { processed: processedCount, forfeited: forfeitedCount };
}

module.exports = {
  evaluateReferralMilestoneVesting,
  generateReferralPayrollLineItems,
  checkProbationStatus,
  processMilestonePayouts,
};
