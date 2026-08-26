/**
 * Unit Tests for FX Engine & Audit Logger
 */

import { describe, it, expect } from 'vitest';
import { ExpatriateFxEngine } from './ExpatriateFxEngine';
import { ExpatriateTaxAuditLogger } from './ExpatriateTaxAuditLogger';

describe('Expatriate FX & Audit Tests', () => {
  it('should convert USD to host currency accurately', () => {
    const res = ExpatriateFxEngine.convertCurrency(1000, 'GBP', 0.78);
    expect(res.convertedAmount).toBe(780);
  });

  it('should generate audit log entry', () => {
    const log = ExpatriateTaxAuditLogger.logAudit('EXP-1', 'CALCULATED_HTAX');
    expect(log.assignmentId).toBe('EXP-1');
  });
});
