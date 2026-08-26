/**
 * Employee Stock Purchase Plan (ESPP) Statutory Discount & Lookback Engine
 */

export interface EsppDiscountResult {
  purchasePriceUsd: number;
  discountAmountUsd: number;
  statutoryTaxableDiscountUsd: number;
}

export class EsppStatutoryDiscountEngine {
  public static calculateEsppPurchasePrice(
    offeringDateFmvUsd: number,
    purchaseDateFmvUsd: number,
    discountPercent: number = 15 // 15% standard Section 423 ESPP discount
  ): EsppDiscountResult {
    // 15% discount on lesser of offering date FMV or purchase date FMV (lookback feature)
    const baseFmv = Math.min(offeringDateFmvUsd, purchaseDateFmvUsd);
    const purchasePrice = baseFmv * (1 - discountPercent / 100);
    const discountAmount = purchaseDateFmvUsd - purchasePrice;

    return {
      purchasePriceUsd: Number(purchasePrice.toFixed(2)),
      discountAmountUsd: Number(discountAmount.toFixed(2)),
      statutoryTaxableDiscountUsd: Number(discountAmount.toFixed(2))
    };
  }
}
