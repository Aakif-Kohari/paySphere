/**
 * @fileoverview Multi-Jurisdiction Tax Engine
 * @description Intercepts standard payroll calculations to apply regional state taxes
 * based on the employee's work location. Includes Tax Nexus alert logic.
 * Issue: #1086
 */
const TaxJurisdiction = require('../models/taxJurisdiction.model');
const StateTaxRules = require('../models/stateTaxRules.model');

/**
 * Calculates regional state tax based on progressive brackets or flat rates.
 * 
 * @param {number} annualTaxableIncome - Gross income minus standard deductions
 * @param {Object} rules - The active StateTaxRules document
 * @returns {number} Annual state tax amount
 */
function calculateRegionalTax(annualTaxableIncome, rules) {
    if (!rules) return 0;

    // Apply standard deduction
    const taxableIncome = Math.max(0, annualTaxableIncome - (rules.standardDeduction || 0));

    let tax = 0;

    // Progressive Brackets Calculation
    if (rules.brackets && rules.brackets.length > 0) {
        // Sort brackets by minIncome ascending
        const sortedBrackets = [...rules.brackets].sort((a, b) => a.minIncome - b.minIncome);

        for (const bracket of sortedBrackets) {
            if (taxableIncome <= bracket.minIncome) break;

            const maxForBracket = Math.min(taxableIncome, bracket.maxIncome === Infinity ? Infinity : bracket.maxIncome);
            const taxableInBracket = maxForBracket - bracket.minIncome;

            if (taxableInBracket > 0) {
                tax += (taxableInBracket * (bracket.rate / 100));
            }
        }
    } else if (rules.flatTaxRate > 0) {
        // Flat Tax Calculation
        tax = taxableIncome * (rules.flatTaxRate / 100);
    }

    // Apply Surcharge (e.g., 10% surcharge on the calculated tax)
    if (rules.surchargeRate > 0) {
        tax += (tax * (rules.surchargeRate / 100));
    }

    // Add fixed Professional Tax (annualized)
    tax += (rules.professionalTax || 0);

    return Math.round(tax * 100) / 100;
}

/**
 * Fetches the active tax rules for a specific state code and tenant.
 * @param {string} tenantId 
 * @param {string} stateCode 
 * @returns {Promise<Object|null>}
 */
async function getActiveStateRules(tenantId, stateCode) {
    const jurisdiction = await TaxJurisdiction.findOne({ tenantId, stateCode: stateCode.toUpperCase(), isActive: true });
    if (!jurisdiction) return null;

    const now = new Date();
    const rules = await StateTaxRules.findOne({
        tenantId,
        jurisdictionId: jurisdiction._id,
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now }],
    }
  ).sort({ effectiveFrom: -1 });

return rules;
}

/**
 * Checks if the company has established tax nexus in the employee's state.
 * If not, flags a compliance alert for HR.
 * 
 * @param {string} tenantId 
 * @param {string} employeeStateCode 
 * @returns {Promise<{hasNexus: boolean, alertMessage: string}>}
 */
async function checkTaxNexus(tenantId, employeeStateCode) {
    const jurisdiction = await TaxJurisdiction.findOne({
        tenantId,
        stateCode: employeeStateCode.toUpperCase()
    });

    if (!jurisdiction) {
        return {
            hasNexus: false,
            alertMessage: `Tax Nexus Alert: Employee resides in ${employeeStateCode}, but the company is not registered for state tax in this jurisdiction.`
        };
    }

    if (!jurisdiction.hasNexus) {
        return {
            hasNexus: false,
            alertMessage: `Compliance Warning: Company presence in ${employeeStateCode} is tracked, but formal tax nexus is not established.`
        };
    }

    return { hasNexus: true, alertMessage: '' };
}

module.exports = { calculateRegionalTax, getActiveStateRules, checkTaxNexus };
