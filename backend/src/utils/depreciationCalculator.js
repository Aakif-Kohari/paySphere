/**
 * @fileoverview Depreciation Calculation Engine
 * @description Implements Straight Line Method (SLM) and Written Down Value (WDV)
 * depreciation logic for company assets.
 * Issue: #955
 */

/**
 * Calculates monthly depreciation using Straight Line Method (SLM).
 * Formula: (Purchase Price - Salvage Value) / (Useful Life in Months)
 * 
 * @param {number} purchasePrice 
 * @param {number} salvageValue 
 * @param {number} usefulLifeYears 
 * @returns {number} Monthly depreciation amount
 */
function calculateSLM(purchasePrice, salvageValue, usefulLifeYears) {
    const usefulLifeMonths = usefulLifeYears * 12;
    if (usefulLifeMonths <= 0) return 0;
    return (purchasePrice - salvageValue) / usefulLifeMonths;
}

/**
 * Calculates monthly depreciation using Written Down Value (WDV) method.
 * Formula: Current Book Value * (1 - (Salvage/Purchase)^(1/UsefulLife)) / 12
 * Simplified for monthly: Annual Rate = 1 - (Salvage/Purchase)^(1/Years)
 * Monthly Rate = Annual Rate / 12 (approximation for accounting simplicity)
 * 
 * @param {number} currentBookValue 
 * @param {number} purchasePrice 
 * @param {number} salvageValue 
 * @param {number} usefulLifeYears 
 * @returns {number} Monthly depreciation amount
 */
function calculateWDV(currentBookValue, purchasePrice, salvageValue, usefulLifeYears) {
    if (usefulLifeYears <= 0 || purchasePrice <= 0) return 0;
    if (currentBookValue <= salvageValue) return 0;

    // Annual depreciation rate
    const ratio = salvageValue / purchasePrice;
    const annualRate = 1 - Math.pow(ratio, 1 / usefulLifeYears);

    // Monthly rate approximation
    const monthlyRate = annualRate / 12;

    return currentBookValue * monthlyRate;
}

/**
 * Main dispatcher to calculate monthly depreciation for an asset.
 * 
 * @param {Object} asset - The Asset document
 * @param {Object} category - The AssetCategory document
 * @returns {number} Depreciation expense for the current month
 */
function calculateMonthlyDepreciation(asset, category) {
    const salvageValue = asset.purchasePrice * (category.salvageValuePercentage / 100);

    if (asset.currentBookValue <= salvageValue) {
        return 0; // Fully depreciated
    }

    let expense = 0;
    if (category.depreciationMethod === 'SLM') {
        expense = calculateSLM(asset.purchasePrice, salvageValue, category.usefulLifeYears);
    } else if (category.depreciationMethod === 'WDV') {
        expense = calculateWDV(asset.currentBookValue, asset.purchasePrice, salvageValue, category.usefulLifeYears);
    }

    // Ensure we don't depreciate below salvage value
    const maxAllowed = asset.currentBookValue - salvageValue;
    return Math.min(expense, maxAllowed);
}

module.exports = { calculateMonthlyDepreciation, calculateSLM, calculateWDV };
