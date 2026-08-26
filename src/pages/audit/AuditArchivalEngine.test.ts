/**
 * Unit Tests for Audit Archival Engine
 */

import { describe, it, expect } from 'vitest';
import { AuditArchivalEngine } from './AuditArchivalEngine';

describe('AuditArchivalEngine Tests', () => {
  it('should enforce 7-year SOX retention policy correctly', () => {
    const res = AuditArchivalEngine.calculateRetentionArchival(5000);
    expect(res.retentionYears).toBe(7);
    expect(res.archiveStorageTier).toBe('GLACIER_DEEP_ARCHIVE');
  });
});
