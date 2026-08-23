/**
 * Enterprise Unit Test Suite for Pension & 401(k) Retirement Compliance Engine
 * 
 * Architectural Specifications:
 * - Validates pay period employee deferral calculations and statutory cap enforcement ($23,000 + $7,500 catch-up).
 * - Tests tiered employer matching formula (100% on first 3% + 50% on next 2%).
 * - Asserts IRS ADP (Actual Deferral Percentage) non-discrimination compliance testing between HCE and NHCE employee groups.
 *
 * @module PensionRetirementServiceTest
 * @version 7.0.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PensionRetirementState, EmployeeRetirementProfile } from './PensionRetirementModel';
import { PensionRetirementService } from './PensionRetirementService';

describe('PensionRetirementEngine Unit Tests', () => {
  let state: PensionRetirementState;
  let service: PensionRetirementService;

  beforeEach(() => {
    state = new PensionRetirementState();
    service = new PensionRetirementService(state);
  });

  describe('Pay Period Deferral & Employer Match Calculations', () => {
    it('should calculate tiered employer match correctly (4% max match on 5%+ deferral)', () => {
      const profile: EmployeeRetirementProfile = {
        employeeId: 'test-emp-1',
        fullName: 'Jane Doe',
        age: 35,
        isHighlyCompensated: false,
        annualSalaryUsd: 100000,
        planType: '401K_TRADITIONAL',
        employeeDeferralPercent: 6, // 6% deferral
        catchUpContributionUsd: 0,
        ytdDeferralUsd: 0,
        ytdEmployerMatchUsd: 0
      };

      const result = service.calculatePayPeriodMatch(profile, 5000);
      expect(result.employeeContributionUsd).toBe(300); // 6% of $5,000
      expect(result.employerMatchUsd).toBe(200); // 4% of $5,000 (3% * 100% + 2% * 50%)
      expect(result.totalPeriodContributionUsd).toBe(500);
    });

    it('should enforce statutory deferral cap limit ($23,000)', () => {
      const profile: EmployeeRetirementProfile = {
        employeeId: 'test-emp-cap',
        fullName: 'John Smith',
        age: 40,
        isHighlyCompensated: true,
        annualSalaryUsd: 200000,
        planType: '401K_TRADITIONAL',
        employeeDeferralPercent: 10,
        catchUpContributionUsd: 0,
        ytdDeferralUsd: 22800, // $200 remaining room
        ytdEmployerMatchUsd: 8000
      };

      const result = service.calculatePayPeriodMatch(profile, 10000);
      expect(result.employeeContributionUsd).toBe(200); // capped at remaining room $200
      expect(result.statutoryLimitReached).toBe(true);
      expect(result.remainingDeferralRoomUsd).toBe(0);
    });
  });

  describe('ADP Non-Discrimination Compliance Test', () => {
    it('should mark plan as compliant when HCE ADP <= NHCE ADP + 2%', () => {
      const profiles: EmployeeRetirementProfile[] = [
        { employeeId: '1', fullName: 'HCE1', age: 40, isHighlyCompensated: true, annualSalaryUsd: 160000, planType: '401K_TRADITIONAL', employeeDeferralPercent: 6, catchUpContributionUsd: 0, ytdDeferralUsd: 0, ytdEmployerMatchUsd: 0 },
        { employeeId: '2', fullName: 'NHCE1', age: 30, isHighlyCompensated: false, annualSalaryUsd: 80000, planType: '401K_TRADITIONAL', employeeDeferralPercent: 5, catchUpContributionUsd: 0, ytdDeferralUsd: 0, ytdEmployerMatchUsd: 0 }
      ];

      const test = service.evaluateAdpNonDiscriminationTest(profiles);
      expect(test.isCompliant).toBe(true);
    });
  });
});
