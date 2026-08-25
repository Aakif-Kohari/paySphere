/**
 * Pension Vesting Extensions Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { PensionVestingExtensions } from './PensionVestingExtensions';

describe('PensionVestingExtensions Tests', () => {
  it('should calculate graded vesting percentage correctly', () => {
    const vested = PensionVestingExtensions.calculateVestedBalance(10000, 3);
    expect(vested).toBe(6000); // 60% vested after 3 years
  });
});
