/**
 * Unit Tests for SOD Compliance Engine
 */

import { describe, it, expect } from 'vitest';
import { SodComplianceEngine } from './SodComplianceEngine';

describe('SodComplianceEngine Tests', () => {
  it('should flag self-approval conflict correctly', () => {
    const res = SodComplianceEngine.checkSegregationOfDuties('USER1', 'USER1');
    expect(res.hasConflict).toBe(true);
  });
});
