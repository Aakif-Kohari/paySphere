/**
 * Enterprise Equity Compensation & ESOP Service Engine.
 * Calculates option vesting progress over time, estimates AMT / capital gains taxes,
 * processes stock option exercises, and updates cap table valuations.
 */

const EnterpriseEquityGrant = require('../models/EnterpriseEquityGrantModel');

class EquityCompensationService {
  /**
   * Computes current vested option count based on grant date and cliff schedules.
   */
  static calculateVestedOptions(totalGranted, cliffMonths, totalMonths, elapsedMonths) {
    if (elapsedMonths < cliffMonths) return 0;
    if (elapsedMonths >= totalMonths) return totalGranted;

    const postCliffFraction = elapsedMonths / totalMonths;
    return Math.floor(totalGranted * postCliffFraction);
  }

  /**
   * Grants stock options / RSUs to an employee.
   */
  static async issueGrant(grantData) {
    const newGrant = new EnterpriseEquityGrant({
      grantId: `ESOP-GRANT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      ...grantData,
      vestedOptionsCount: 0,
      exercisedOptionsCount: 0,
      grantStatus: 'ACTIVE_VESTING',
    });

    return await newGrant.save();
  }

  /**
   * Executes a stock option exercise transaction for vested shares.
   */
  static async exerciseOptions(grantId, sharesToExerciseCount) {
    const grant = await EnterpriseEquityGrant.findOne({ grantId });
    if (!grant) {
      throw new Error(`Equity grant ${grantId} not found.`);
    }

    const availableForExercise = grant.vestedOptionsCount - grant.exercisedOptionsCount;
    if (sharesToExerciseCount > availableForExercise) {
      throw new Error(`Cannot exercise ${sharesToExerciseCount} shares. Only ${availableForExercise} vested options available.`);
    }

    const totalCost = parseFloat((sharesToExerciseCount * grant.strikePriceUsd).toFixed(2));
    const spreadPerShare = Math.max(0, grant.currentFmvUsd - grant.strikePriceUsd);
    const estimatedTax = parseFloat((sharesToExerciseCount * spreadPerShare * 0.28).toFixed(2)); // ~28% AMT/CapGain estimate

    const exerciseRecord = {
      exerciseId: `EXER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      sharesExercisedCount: sharesToExerciseCount,
      exerciseStrikePrice: grant.strikePriceUsd,
      fairMarketValueAtExercise: grant.currentFmvUsd,
      totalCostUsd: totalCost,
      capitalGainTaxEstimateUsd: estimatedTax,
      exerciseStatus: 'EXECUTED',
    };

    grant.exercisedOptionsCount += sharesToExerciseCount;
    grant.exerciseHistory.push(exerciseRecord);

    if (grant.exercisedOptionsCount >= grant.totalOptionsGranted) {
      grant.grantStatus = 'EXERCISED_OUT';
    }

    return await grant.save();
  }

  /**
   * Updates Fair Market Value (FMV) following a 409A valuation audit.
   */
  static async updateFairMarketValue(newFmvUsd) {
    return await EnterpriseEquityGrant.updateMany({}, { $set: { currentFmvUsd: newFmvUsd } });
  }
}

module.exports = EquityCompensationService;
