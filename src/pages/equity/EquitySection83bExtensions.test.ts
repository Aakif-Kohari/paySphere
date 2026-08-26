/**
 * Unit Tests for Section 83(b) Extensions
 */

import { describe, it, expect } from 'vitest';
import { EquitySection83bExtensions } from './EquitySection83bExtensions';

describe('EquitySection83bExtensions Tests', () => {
  it('should calculate Section 83(b) future tax savings correctly', () => {
    const result = EquitySection83bExtensions.calculateSection83bBenefit(1000, 10, 2, 50, 22);
    expect(result.taxableIncomeRecognizedAtGrantUsd).toBe(8000); // (10 - 2) * 1000
    expect(result.futureVestingTaxAvoidedUsd).toBe(8800); // (48k * 22%) - (8k * 22%)
  });
});
