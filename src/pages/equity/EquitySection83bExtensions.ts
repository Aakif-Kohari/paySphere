/**
 * Section 83(b) Election & ESPP Discount Calculation Extensions
 */

export interface Section83bCalculationResult {
  grantFmvUsd: number;
  strikePriceUsd: number;
  taxableIncomeRecognizedAtGrantUsd: number;
  futureVestingTaxAvoidedUsd: number;
}

export class EquitySection83bExtensions {
  public static calculateSection83bBenefit(
    shares: number,
    grantFmvUsd: number,
    strikePriceUsd: number,
    estimatedVestingFmvUsd: number,
    taxRatePercent: number = 22
  ): Section83bCalculationResult {
    const grantSpread = Math.max(0, (grantFmvUsd - strikePriceUsd) * shares);
    const estimatedVestingSpread = Math.max(0, (estimatedVestingFmvUsd - strikePriceUsd) * shares);

    const taxAtGrant = grantSpread * (taxRatePercent / 100);
    const taxAtVestingWithout83b = estimatedVestingSpread * (taxRatePercent / 100);

    return {
      grantFmvUsd,
      strikePriceUsd,
      taxableIncomeRecognizedAtGrantUsd: Number(grantSpread.toFixed(2)),
      futureVestingTaxAvoidedUsd: Number(Math.max(0, taxAtVestingWithout83b - taxAtGrant).toFixed(2))
    };
  }
}
