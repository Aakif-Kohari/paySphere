/**
 * @fileoverview Valuation & Settlement Engine
 * @description Calculates phantom equity payouts, vesting schedules, and tax gross-ups.
 * Issue: #1474
 */

/**
 * Calculates the number of vested units based on the grant date and current date.
 * @param {Date} grantDate 
 * @param {number} totalUnits 
 * @param {number} cliffMonths 
 * @param {number} durationMonths 
 * @param {Date} currentDate 
 * @returns {number} Vested units
 */
function calculateVestedUnits(grantDate, totalUnits, cliffMonths, durationMonths, currentDate) {
    const start = new Date(grantDate);
    const now = new Date(currentDate);

    const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

    if (monthsElapsed < cliffMonths) return 0; // Haven't hit the cliff yet
    if (monthsElapsed >= durationMonths) return totalUnits; // Fully vested

    // Pro-rata vesting after cliff (assuming monthly vesting post-cliff)
    const vestedRatio = monthsElapsed / durationMonths;
    return Math.floor(totalUnits * vestedRatio);
}

/**
 * Calculates the cash payout for a phantom grant based on current valuation.
 * @param {number} vestedUnits 
 * @param {number} strikePrice 
 * @param {number} currentPricePerUnit 
 * @returns {{ appreciationPerUnit: number, grossPayout: number }}
 */
function calculatePayout(vestedUnits, strikePrice, currentPricePerUnit) {
    const appreciationPerUnit = Math.max(0, currentPricePerUnit - strikePrice);
    const grossPayout = Math.round(vestedUnits * appreciationPerUnit * 100) / 100;

    return { appreciationPerUnit, grossPayout };
}

/**
 * Calculates the gross-up amount required to cover the income tax burden on the cash bonus.
 * Formula: Gross-Up = Gross Payout * (TaxRate / (1 - TaxRate))
 * 
 * @param {number} grossPayout 
 * @param {number} marginalTaxRate 
 * @returns {{ grossUpAmount: number, totalPayrollInjection: number, taxWithheld: number, netPayout: number }}
 */
function calculateTaxGrossUp(grossPayout, marginalTaxRate) {
    if (marginalTaxRate >= 1 || grossPayout <= 0) {
        return { grossUpAmount: 0, totalPayrollInjection: grossPayout, taxWithheld: 0, netPayout: grossPayout };
    }

    const grossUpAmount = Math.round((grossPayout * (marginalTaxRate / (1 - marginalTaxRate))) * 100) / 100;
    const totalPayrollInjection = grossPayout + grossUpAmount;
    const taxWithheld = Math.round(totalPayrollInjection * marginalTaxRate * 100) / 100;
    const netPayout = Math.round((totalPayrollInjection - taxWithheld) * 100) / 100;

    return { grossUpAmount, totalPayrollInjection, taxWithheld, netPayout };
}

module.exports = { calculateVestedUnits, calculatePayout, calculateTaxGrossUp };
