/**
 * Unit Tests for Forensic Anomaly Scanner
 */

import { describe, it, expect } from 'vitest';
import { ForensicAnomalyScanner } from './ForensicAnomalyScanner';

describe('ForensicAnomalyScanner Tests', () => {
  it('should flag ghost employee pattern correctly', () => {
    const res = ForensicAnomalyScanner.scanGhostEmployeeRisk(false, false, 120);
    expect(res.isPotentialGhost).toBe(true);
    expect(res.riskScore).toBe(95);
  });
});
