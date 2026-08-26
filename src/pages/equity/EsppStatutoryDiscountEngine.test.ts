/**
 * Unit Tests for ESPP Statutory Discount Engine
 */

import { describe, it, expect } from 'vitest';
import { EsppStatutoryDiscountEngine } from './EsppStatutoryDiscountEngine';

describe('EsppStatutoryDiscountEngine Tests', () => {
  it('should calculate 15% lookback purchase price correctly', () => {
    const res = EsppStatutoryDiscountEngine.calculateEsppPurchasePrice(100, 120, 15);
    expect(res.purchasePriceUsd).toBe(85); // 15% discount on $100 lookback price
    expect(res.discountAmountUsd).toBe(35); // 120 - 85
  });
});
