const mongoose = require('mongoose');
const TaxBracket = require('../models/taxBracket.model');
const logger = require('../utils/logger');
const {
  round2,
  taxOn,
  effectiveRate,
  validateSlabs,
} = require('../utils/taxCalculator');

/**
 * The tax engine from #586, with its slab arithmetic corrected (#616).
 *
 * The calculation itself now lives in utils/taxCalculator.js as pure functions.
 * What is left here is the part that talks to the database: find the right
 * table, decide what to do when there isn't one, and assemble the answer.
 *
 * See utils/taxCalculator.js for the full account of what the original loop got
 * wrong. In short: it subtracted band widths from a running remainder, which
 * meant income above a bounded top slab went untaxed, slab order changed the
 * answer, `maxIncome: 0` was read as "unbounded", and `fixedDeduction` was
 * charged once per slab the income passed through.
 */

/**
 * The "nothing to charge" answer.
 *
 * `effectiveRate: 0` rather than `NaN`: `#586` divided by the gross unguarded,
 * so a zero income produced `0/0`, which serialises to `null` and looks like a
 * missing field rather than a failed calculation.
 *
 * @returns {{totalTax: number, socialSecurity: number, effectiveRate: number, currency: null, configured: boolean, breakdown: object[]}}
 */
function nothingOwed() {
  return {
    totalTax: 0,
    socialSecurity: 0,
    effectiveRate: 0,
    currency: null,
    configured: false,
    breakdown: [],
  };
}

class TaxService {
  /**
   * Tax and contributions on a gross annual income.
   *
   * @param {string} tenantId the company whose table to use
   * @param {string} region the table's region key
   * @param {number} grossAnnualIncome
   * @returns {Promise<{totalTax: number, socialSecurity: number, effectiveRate: number, currency: string|null, configured: boolean, breakdown: object[], errors?: string[]}>}
   */
  static async calculateTax(tenantId, region, grossAnnualIncome) {
    const gross = Number(grossAnnualIncome);

    // A negative gross is not a refund, it is a bad input. `#586` would have
    // returned a negative tax and a negative effective rate for one.
    if (!Number.isFinite(gross) || gross <= 0) {
      return nothingOwed();
    }

    // An undefined tenant is not a filter that matches nothing — the driver
    // drops the key, and `findOne({ region })` then returns whichever company's
    // table it reaches first (#612).
    if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
      logger.warn('Tax calculation attempted without a tenant', { region });
      return nothingOwed();
    }

    const taxConfig = await TaxBracket.findOne({ tenantId, region });

    if (!taxConfig) {
      // No table configured for this region. Zero, and say so — the caller can
      // tell "nothing is owed" apart from "nobody has set this up", which
      // `#586`'s bare zeros could not.
      return nothingOwed();
    }

    const configErrors = validateSlabs(taxConfig.brackets);
    if (configErrors.length > 0) {
      // Charging a number derived from a table that does not add up is worse
      // than charging nothing and raising the alarm.
      logger.error('Tax table is not usable', {
        tenantId: String(tenantId),
        region,
        errors: configErrors,
      });

      return { ...nothingOwed(), configured: true, errors: configErrors };
    }

    const { totalTax, breakdown } = taxOn(gross, taxConfig.brackets);

    const socialSecurity = round2(
      gross * ((Number(taxConfig.socialSecurityRate) || 0) / 100),
    );

    return {
      totalTax,
      socialSecurity,
      effectiveRate: effectiveRate(totalTax, socialSecurity, gross),
      currency: taxConfig.currency || null,
      configured: true,
      breakdown,
    };
  }
}

module.exports = TaxService;
