/**
 * @fileoverview Referral Payout Engine
 * @description Monitors referred employees' probation status and triggers 
 * milestone payouts into the payroll system.
 * Issue: #1208
 */
const { ReferralCandidate, ReferralPayout } = require('../models/referral.model');
const Employee = require('../models/employee.model');
const logger = require('./logger');

/**
 * Checks if a referred employee has completed their probation period.
 * @param {string} employeeId 
 * @returns {Promise<{completed: boolean, endDate: Date}>}
 */
async function checkProbationStatus(employeeId) {
    const employee = await Employee.findById(employeeId).select('probationEndDate isActive');
    if (!employee) return { completed: false, endDate: null };

    const now = new Date();
    // If no probation end date is set, assume immediate completion or lifetime employment
    if (!employee.probationEndDate) return { completed: true, endDate: null };

    return {
        completed: now >= new Date(employee.probationEndDate),
        endDate: employee.probationEndDate
    };
}

/**
 * Scans all "Hired" referrals and processes pending milestone payouts.
 * Implements the "Probation Guard" to forfeit bonuses if the employee leaves early.
 * 
 * @param {string} tenantId 
 * @returns {Promise<{processed: number, forfeited: number}>}
 */
async function processMilestonePayouts(tenantId) {
    const hiredReferrals = await ReferralCandidate.find({
        tenantId,
        status: 'Hired',
        hiredEmployeeId: { $ne: null }
    }).populate('hiredEmployeeId', 'fullName isActive probationEndDate');

    let processedCount = 0;
    let forfeitedCount = 0;

    for (const referral of hiredReferrals) {
        const pendingPayouts = await ReferralPayout.find({
            tenantId,
            candidateId: referral._id,
            status: 'Pending'
        });

        if (pendingPayouts.length === 0) continue;

        // Probation Guard: Check if referred employee is still active
        const referredEmp = referral.hiredEmployeeId;
        if (!referredEmp.isActive) {
            // Forfeit all pending payouts
            for (const payout of pendingPayouts) {
                payout.status = 'Forfeited';
                payout.forfeitureReason = 'Referred employee is no longer active.';
                await payout.save();
                forfeitedCount++;
            }
            continue;
        }

        // Check Probation Completion for final milestones
        const probStatus = await checkProbationStatus(referral.hiredEmployeeId);

        for (const payout of pendingPayouts) {
            // Logic: If milestone requires probation completion, check status
            if (payout.milestoneLabel.toLowerCase().includes('probation') || payout.milestoneLabel.toLowerCase().includes('retention')) {
                if (probStatus.completed) {
                    payout.status = 'Approved'; // Ready for next payroll run
                    payout.processedAt = new Date();
                    await payout.save();
                    processedCount++;
                    logger.info(`[Referral] Approved retention bonus for ${referral.referrerId}`);
                }
            } else {
                // Joining bonuses are usually approved immediately upon hiring, 
                // but if they are still pending here, approve them now.
                if (payout.status === 'Pending') {
                    payout.status = 'Approved';
                    payout.processedAt = new Date();
                    await payout.save();
                    processedCount++;
                }
            }
        }
    }

    return { processed: processedCount, forfeited: forfeitedCount };
}

module.exports = { processMilestonePayouts, checkProbationStatus };
