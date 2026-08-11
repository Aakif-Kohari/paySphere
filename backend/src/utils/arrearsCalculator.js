/**
 * @fileoverview Retroactive Arrears Calculation Engine
 * @description Calculates exact financial deltas for backdated salary revisions,
 * handling pro-ration for mid-month effective dates and bundling into current payroll.
 * Issue: #931
 */

const PayrollUpdate = require('../models/payroll.model');
const ArrearsLedger = require('../models/arrearsLedger');
const logger = require('./logger');

/**
 * Gets the number of days in a specific month/year.
 * Correctly handles leap years.
 */
function getDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

/**
 * Calculates pro-rated gross salary for a partial month.
 * @param {number} monthlyGross 
 * @param {number} effectiveDay - 1-indexed day of the month (e.g., 15)
 * @param {number} totalDaysInMonth 
 * @returns {number} Pro-rated amount
 */
function calculateProRatedGross(monthlyGross, effectiveDay, totalDaysInMonth) {
    // If effective on the 15th of a 30-day month, they work 16 days (15th to 30th inclusive)
    const activeDays = totalDaysInMonth - effectiveDay + 1;
    return Math.round((monthlyGross * (activeDays / totalDaysInMonth)) * 100) / 100;
}

/**
 * Main engine: Detects backdated revisions and generates unreleased arrears ledger entries.
 * Called immediately after a new SalaryStructure revision is saved.
 * 
 * @param {Object} revision - The newly created SalaryStructure document
 * @param {Object} previousRevision - The revision that was active before this one (can be null)
 * @param {string} tenantId 
 */
async function processRetroactiveArrears(revision, previousRevision, tenantId) {
    const effectiveDate = new Date(revision.effectiveFrom);
    const currentDate = new Date();

    // If effective date is in the future or current month, no arrears needed yet
    // (Current month will just use the new rate directly in payroll)
    if (effectiveDate >= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) {
        return;
    }

    const oldGross = previousRevision ? previousRevision.grossMonthly : 0;
    const newGross = revision.grossMonthly;

    if (newGross <= oldGross) {
        logger.info('No arrears generated: New gross is not higher than old gross.', { revisionId: revision._id });
        return; // Arrears usually only apply to increments. Decrements require manual recovery.
    }

    let iterDate = new Date(effectiveDate);
    const entriesToCreate = [];

    // Iterate month by month from effective date up to (but not including) the current month
    while (iterDate < new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) {
        const month = iterDate.getMonth() + 1;
        const year = iterDate.getFullYear();
        const totalDays = getDaysInMonth(month, year);

        let monthOldGross = oldGross;
        let monthNewGross = newGross;
        let proRatedDays = null;

        // If this is the first month of the revision, apply pro-ration
        if (iterDate.getMonth() === effectiveDate.getMonth() && iterDate.getFullYear() === effectiveDate.getFullYear()) {
            const effectiveDay = effectiveDate.getDate();
            monthOldGross = calculateProRatedGross(oldGross, effectiveDay, totalDays);
            monthNewGross = calculateProRatedGross(newGross, effectiveDay, totalDays);
            proRatedDays = totalDays - effectiveDay + 1;
        }

        const grossDelta = Math.round((monthNewGross - monthOldGross) * 100) / 100;

        if (grossDelta > 0) {
            entriesToCreate.push({
                tenantId,
                employeeId: revision.employeeId,
                revisionId: revision._id,
                targetMonth: month,
                targetYear: year,
                oldGross: monthOldGross,
                newGross: monthNewGross,
                grossDelta,
                proRatedDays,
                totalDaysInMonth: totalDays,
                // Simplified net calculation: In reality, tax deltas must be computed. 
                // For this engine, we assume flat delta or pass grossDelta to payroll for tax engine to handle.
                netArrearsPayout: grossDelta,
                isReleased: false,
            });
        }

        // Move to next month
        iterDate.setMonth(iterDate.getMonth() + 1);
    }

    if (entriesToCreate.length > 0) {
        // Use ordered: false to ignore duplicate key errors if this runs twice
        await ArrearsLedger.insertMany(entriesToCreate, { ordered: false });
        logger.info(`Generated ${entriesToCreate.length} arrears ledger entries for employee ${revision.employeeId}`);
    }
}

/**
 * Fetches and bundles unreleased arrears into the current payroll run.
 * Called inside `submitPayrollForReview` before finalizing.
 * 
 * @param {string} employeeId 
 * @param {string} tenantId 
 * @returns {Promise<{ totalArrears: number, arrearsBreakdown: Array, ledgerIds: Array }>}
 */
async function bundleUnreleasedArrears(employeeId, tenantId) {
    const unreleasedArrears = await ArrearsLedger.find({
        employeeId,
        tenantId,
        isReleased: false,
    }).sort({ targetYear: 1, targetMonth: 1 }).lean();

    if (unreleasedArrears.length === 0) {
        return { totalArrears: 0, arrearsBreakdown: [], ledgerIds: [] };
    }

    const totalArrears = unreleasedArrears.reduce((sum, a) => sum + a.netArrearsPayout, 0);
    const ledgerIds = unreleasedArrears.map(a => a._id);

    const arrearsBreakdown = unreleasedArrears.map(a => ({
        month: a.targetMonth,
        year: a.targetYear,
        amount: a.netArrearsPayout,
        isProRated: a.proRatedDays !== null,
        days: a.proRatedDays || a.totalDaysInMonth,
    }));

    return { totalArrears, arrearsBreakdown, ledgerIds };
}

/**
 * Marks arrears as released and links them to the finalized payroll record.
 * @param {Array} ledgerIds 
 * @param {string} payrollId 
 */
async function markArrearsReleased(ledgerIds, payrollId) {
    if (!ledgerIds || ledgerIds.length === 0) return;
    await ArrearsLedger.updateMany(
        { _id: { $in: ledgerIds } },
        { $set: { isReleased: true, releasedInPayrollId: payrollId } }
    );
}

module.exports = {
    processRetroactiveArrears,
    bundleUnreleasedArrears,
    markArrearsReleased,
};
