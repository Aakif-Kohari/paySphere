/**
 * Enterprise Unit Test Suite for Equity Compensation & Stock Options Tax Engine
 * 
 * Architectural Specifications:
 * - Validates statutory tax withholding on NSO options exercises.
 * - Asserts ISO AMT preference item calculations without ordinary tax withholding.
 * - Tests RSU vesting supplemental wage calculations.
 *
 * @module EquityEsopServiceTest
 * @version 7.3.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EquityEsopState, EquityGrant } from './EquityEsopModel';
import { EquityEsopService } from './EquityEsopService';

describe('EquityEsopEngine Unit Tests', () => {
  let state: EquityEsopState;
  let service: EquityEsopService;

  beforeEach(() => {
    state = new EquityEsopState();
    service = new EquityEsopService(state);
  });

  describe('NSO & RSU Statutory Payroll Tax Withholding', () => {
    it('should calculate 22% federal supplemental and 7.65% FICA withholding on NSO spread correctly', () => {
      const grant: EquityGrant = {
        grantId: 'nso-1',
        employeeId: 'emp1',
        employeeName: 'Jane Option',
        grantType: 'NSO',
        grantDate: '2024-01-01',
        sharesGranted: 1000,
        strikePriceUsd: 10.00,
        currentFmvUsd: 50.00,
        vestedShares: 1000,
        hasSection83bElection: false,
        supplementalWageRatePercent: 22
      };

      // Exercise 1,000 shares @ $50 FMV ($10 strike). Gross Spread = (50 - 10) * 1000 = $40,000
      const result = service.calculateExerciseTaxWithholding(grant, 1000, 50.00);

      expect(result.grossSpreadUsd).toBe(40000);
      expect(result.federalSupplementalTaxUsd).toBe(8800); // 22% of $40,000
      expect(result.ficaMedicareTaxUsd).toBe(580); // 1.45% of $40,000
      expect(result.ficaSocialSecurityTaxUsd).toBe(2480); // 6.2% of $40,000
      expect(result.totalPayableWithholdingUsd).toBe(11860); // 8800 + 580 + 2480
    });
  });

  describe('ISO AMT Preference Tracking', () => {
    it('should track ISO spread as AMT preference item without ordinary tax withholding', () => {
      const grant: EquityGrant = {
        grantId: 'iso-1',
        employeeId: 'emp2',
        employeeName: 'John ISO',
        grantType: 'ISO',
        grantDate: '2024-01-01',
        sharesGranted: 500,
        strikePriceUsd: 20.00,
        currentFmvUsd: 60.00,
        vestedShares: 500,
        hasSection83bElection: false,
        supplementalWageRatePercent: 22
      };

      // Gross Spread = (60 - 20) * 500 = $20,000
      const result = service.calculateExerciseTaxWithholding(grant, 500, 60.00);

      expect(result.grossSpreadUsd).toBe(20000);
      expect(result.federalSupplementalTaxUsd).toBe(0);
      expect(result.totalPayableWithholdingUsd).toBe(0);
      expect(result.isoAmtPreferenceItemUsd).toBe(20000);
    });
  });
});
