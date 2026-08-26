/**
 * Enterprise Unit Test Suite for Garnishment Service Engine
 * 
 * Architectural Specifications:
 * - Asserts CCPA cap percentage calculations for supporting vs not supporting second family.
 * - Validates multi-order priority allocation and CCPA limit withholding capping.
 *
 * @module GarnishmentServiceTest
 * @version 7.1.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GarnishmentState, GarnishmentOrder } from './GarnishmentModel';
import { GarnishmentService } from './GarnishmentService';

describe('GarnishmentEngine Unit Tests', () => {
  let state: GarnishmentState;
  let service: GarnishmentService;

  beforeEach(() => {
    state = new GarnishmentState();
    service = new GarnishmentService(state);
  });

  describe('CCPA Cap Calculations', () => {
    it('should return 50% CCPA cap for child support supporting second family not in arrears', () => {
      const order: GarnishmentOrder = {
        orderId: '1',
        employeeId: 'emp1',
        orderType: 'CHILD_SUPPORT',
        courtOrderNumber: '123',
        stateJurisdiction: 'CA',
        orderedAmountUsd: 500,
        isPercentage: false,
        percentageRate: 0,
        supportsSecondFamily: true,
        isInArrearsMoreThan12Weeks: false,
        priorityRank: 1
      };

      const cap = service.calculateCcpaCapPercentage(order);
      expect(cap).toBe(0.50);
    });

    it('should return 65% CCPA cap for child support NOT supporting second family AND in arrears > 12 weeks', () => {
      const order: GarnishmentOrder = {
        orderId: '2',
        employeeId: 'emp2',
        orderType: 'CHILD_SUPPORT',
        courtOrderNumber: '456',
        stateJurisdiction: 'NY',
        orderedAmountUsd: 800,
        isPercentage: false,
        percentageRate: 0,
        supportsSecondFamily: false,
        isInArrearsMoreThan12Weeks: true,
        priorityRank: 1
      };

      const cap = service.calculateCcpaCapPercentage(order);
      expect(cap).toBe(0.65);
    });
  });

  describe('Multi-Order Priority Allocation', () => {
    it('should withhold higher priority order first and cap lower priority order under CCPA limit', () => {
      const orders: GarnishmentOrder[] = [
        { orderId: 'cs', employeeId: 'emp', orderType: 'CHILD_SUPPORT', courtOrderNumber: '1', stateJurisdiction: 'TX', orderedAmountUsd: 1200, isPercentage: false, percentageRate: 0, supportsSecondFamily: true, isInArrearsMoreThan12Weeks: false, priorityRank: 1 },
        { orderId: 'cg', employeeId: 'emp', orderType: 'CREDITOR_GARNISHMENT', courtOrderNumber: '2', stateJurisdiction: 'TX', orderedAmountUsd: 800, isPercentage: false, percentageRate: 0, supportsSecondFamily: true, isInArrearsMoreThan12Weeks: false, priorityRank: 2 }
      ];

      // Disposable earnings = $2,000. CCPA cap = 50% ($1,000)
      const results = service.calculateGarnishmentWithholding(3000, 1000, orders);

      const csResult = results.find(r => r.orderId === 'cs');
      const cgResult = results.find(r => r.orderId === 'cg');

      expect(csResult?.actualWithheldUsd).toBe(1000); // capped at total $1000 CCPA room
      expect(cgResult?.actualWithheldUsd).toBe(0); // 0 room left
      expect(cgResult?.isCappedByCcpa).toBe(true);
    });
  });
});
