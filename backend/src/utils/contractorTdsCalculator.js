/**
 * @fileoverview Section 194C TDS Calculation Engine
 * @description Implements statutory logic for TDS on contractor payments.
 * Handles thresholds (30k single / 1L aggregate) and 20% penalty for missing PAN.
 * Issue: #957
 */

const { VendorInvoice } = require('../models/vendor.model');

/**
 * Validates if a PAN is structurally valid (AAAAA1234A format).
 * @param {string} pan 
 * @returns {boolean}
 */
function isValidPAN(pan) {
    if (!pan) return false;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
}

/**
 * Calculates TDS for a specific invoice based on Section 194C rules.
 * 
 * Rules:
 * 1. If single invoice > 30,000 OR aggregate FY > 1,00,000 -> TDS applies.
 * 2. Rate: 1% for Individual/HUF, 2% for Others.
 * 3. If PAN is missing/invalid -> 20% penalty rate.
 * 
 * @param {Object} vendor - The Vendor document
 * @param {number} grossAmount - The current invoice gross amount
 * @param {number} financialYear - The FY start year (e.g., 2024)
 * @param {string} tenantId 
 * @returns {Promise<{ tdsRate: number, tdsAmount: number, netPayable: number, thresholdBreached: boolean }>}
 */
async function calculateTDS194C(vendor, grossAmount, financialYear, tenantId) {
    // 1. Check Aggregate Threshold
    const aggregateResult = await VendorInvoice.aggregate([
        { $match: { tenantId: mongoose.Types.ObjectId(tenantId), vendorId: vendor._id, financialYear } },
        { $group: { _id: null, totalGross: { $sum: '$grossAmount' } } }
    ]);

    const currentAggregate = aggregateResult.length > 0 ? aggregateResult[0].totalGross : 0;
    const projectedAggregate = currentAggregate + grossAmount;

    const singleThreshold = 30000;
    const aggregateThreshold = 100000;

    const thresholdBreached = (grossAmount > singleThreshold) || (projectedAggregate > aggregateThreshold);

    if (!thresholdBreached) {
        return { tdsRate: 0, tdsAmount: 0, netPayable: grossAmount, thresholdBreached: false };
    }

    // 2. Determine Rate
    let tdsRate = 0;
    if (!isValidPAN(vendor.pan)) {
        tdsRate = 20; // Penalty rate under Section 206AA
    } else if (vendor.vendorType === 'Individual/HUF') {
        tdsRate = 1;
    } else {
        tdsRate = 2;
    }

    // 3. Calculate Amounts
    const tdsAmount = Math.round((grossAmount * tdsRate) / 100);
    const netPayable = grossAmount - tdsAmount;

    return { tdsRate, tdsAmount, netPayable, thresholdBreached: true };
}

module.exports = { calculateTDS194C, isValidPAN };
