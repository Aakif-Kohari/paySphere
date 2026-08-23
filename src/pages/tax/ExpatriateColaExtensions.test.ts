/**
 * Unit Tests for Expatriate COLA Extensions
 */

import { describe, it, expect } from 'vitest';
import { ExpatriateColaExtensions } from './ExpatriateColaExtensions';

describe('ExpatriateColaExtensions Tests', () => {
  it('should calculate COLA allowance correctly for high cost host city', () => {
    const res = ExpatriateColaExtensions.calculateColaAllowance(100000, 1.25);
    expect(res.adjustedAllowanceUsd).toBe(25000); // 25% COLA
  });
});
