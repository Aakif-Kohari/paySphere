/**
 * Unit Tests for Garnishment Exemption Engine
 */

import { describe, it, expect } from 'vitest';
import { GarnishmentExemptionEngine } from './GarnishmentExemptionEngine';

describe('GarnishmentExemptionEngine Tests', () => {
  it('should protect statutory 30x federal minimum wage ($217.50)', () => {
    const res = GarnishmentExemptionEngine.calculateStatutoryExemption(500);
    expect(res.weeklyMinWageExemptionUsd).toBe(217.50);
    expect(res.availableForGarnishmentUsd).toBe(282.50);
  });
});
