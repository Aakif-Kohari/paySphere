/**
 * Unit Tests for Tax Policy Evaluator
 */

import { describe, it, expect } from 'vitest';
import { TaxPolicyEvaluator } from './TaxPolicyEvaluator';

describe('TaxPolicyEvaluator Tests', () => {
  it('should compare Tax Equalization vs Tax Protection policies correctly', () => {
    const res = TaxPolicyEvaluator.comparePolicies(20000, 30000);
    expect(res.length).toBe(2);
    expect(res[0].employerGrossUpCostUsd).toBe(10000);
  });
});
