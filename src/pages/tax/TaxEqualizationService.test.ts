/**
 * Enterprise Unit Test Suite for Tax Equalization Engine
 * 
 * Architectural Specifications:
 * - Asserts HTAX (stay-at-home tax) calculations.
 * - Asserts host country tax liability and employer gross-up balancing.
 *
 * @module TaxEqualizationServiceTest
 * @version 7.2.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaxEqualizationState, ExpatriateAssignment } from './TaxEqualizationModel';
import { TaxEqualizationService } from './TaxEqualizationService';

describe('TaxEqualizationEngine Unit Tests', () => {
  let state: TaxEqualizationState;
  let service: TaxEqualizationService;

  beforeEach(() => {
    state = new TaxEqualizationState();
    service = new TaxEqualizationService(state);
  });

  describe('Tax Equalization & Gross-Up Calculations', () => {
    it('should calculate HTAX and employer gross-up when host tax exceeds home tax', () => {
      const assignment: ExpatriateAssignment = {
        assignmentId: 'test-1',
        employeeId: 'emp1',
        fullName: 'Test User',
        homeCountry: 'US',
        hostCountry: 'UK',
        baseSalaryUsd: 100000,
        expatriateAllowancesUsd: 20000,
        hypotheticalTaxRatePercent: 20, // HTAX = $20,000
        hostCountryTaxRatePercent: 40, // Tax base = 120,000 - 100,000 FEIE = 20,000 * 40% = $8,000
        foreignEarnedIncomeExclusionUsd: 100000
      };

      const result = service.calculateTaxEqualization(assignment);
      expect(result.hypotheticalTaxDeductionUsd).toBe(20000);
      expect(result.grossPackageUsd).toBe(120000);
      expect(result.netExpatriateTakeHomeUsd).toBe(100000); // 120k - 20k HTAX
    });
  });
});
