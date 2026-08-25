/**
 * Enterprise Unit Test Suite for Audit Trail Engine
 * 
 * Architectural Specifications:
 * - Asserts SHA-256 cryptographic chain verification.
 * - Asserts real-time salary spike anomaly detection.
 *
 * @module AuditTrailServiceTest
 * @version 7.4.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrailState } from './AuditTrailModel';
import { AuditTrailService } from './AuditTrailService';

describe('AuditTrailEngine Unit Tests', () => {
  let state: AuditTrailState;
  let service: AuditTrailService;

  beforeEach(() => {
    state = new AuditTrailState();
    service = new AuditTrailService(state);
  });

  describe('Cryptographic Chain Verification', () => {
    it('should verify intact SHA-256 log chain correctly', () => {
      const logs = state.getLogChain();
      const result = service.verifyAuditChainIntegrity(logs);
      expect(result.isChainIntact).toBe(true);
      expect(result.totalLogsAnalyzed).toBe(2);
    });

    it('should detect salary spike anomaly > 50%', () => {
      const result = service.detectSalarySpikeAnomaly(100000, 160000);
      expect(result.isAnomaly).toBe(true);
      expect(result.percentIncrease).toBe(60);
    });
  });
});
