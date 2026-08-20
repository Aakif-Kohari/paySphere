const {
  buildVestingSchedule,
  vestedAsOf,
  computePerquisite,
  calculateTenderAllocations,
} = require('../utils/vestingCalculator');

/**
 * Service wrapper for ESOP Vesting calculations and Capital Gains / Perquisite Tax assessments.
 */
class EsopCalculatorService {
  /**
   * Calculates the vesting schedule tranches for a grant.
   * 
   * @param {object} grant - Grant parameters
   * @returns {object} The schedule and tranches
   */
  calculateVestingSchedule(grant) {
    return buildVestingSchedule(grant);
  }

  /**
   * Assesses vested, unvested, and exercisable options as of a specific date.
   * 
   * @param {object} grant - The grant parameters
   * @param {Date|string} date - Assessment date
   * @returns {object} The position details
   */
  assessVestingAsOf(grant, date) {
    return vestedAsOf(grant, date);
  }

  /**
   * Computes taxable perquisite spread, TDS, and cost basis for option exercises.
   * 
   * @param {object} params
   * @param {number} params.optionsExercised - Quantity exercised
   * @param {number} params.fmvPerShare - Fair market value at exercise
   * @param {number} params.exercisePrice - Strike price per share
   * @param {number} [params.taxRatePercent] - Marginal withholding tax rate
   * @returns {object} Valuation and tax details
   */
  calculateOptionExerciseTax({ optionsExercised, fmvPerShare, exercisePrice, taxRatePercent }) {
    return computePerquisite({
      optionsExercised,
      fmvPerShare,
      exercisePrice,
      taxRatePercent,
    });
  }

  /**
   * Estimates secondary tender offer allocations and tax withholdings.
   * 
   * @param {Array<object>} bids - Participant bids
   * @param {number} offerPrice - Tender price per share
   * @param {number} totalPoolShares - Maximum shares available
   * @param {number} taxRate - Default tax rate percent
   * @returns {object} Allocation metrics
   */
  estimateTenderAllocations(bids, offerPrice, totalPoolShares, taxRate) {
    return calculateTenderAllocations(bids, offerPrice, totalPoolShares, taxRate);
  }
}

module.exports = new EsopCalculatorService();
