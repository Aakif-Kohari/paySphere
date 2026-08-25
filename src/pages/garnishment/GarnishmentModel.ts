/**
 * Enterprise Payroll Garnishment & Child Support Withholding Model
 * 
 * Architectural Specifications:
 * - Domain entities for wage garnishment orders under CCPA (Consumer Credit Protection Act).
 * - Supported Order Types: Child Support, Spousal Support, Federal Student Loan Levy, State Tax Levy, Creditor Garnishment.
 * - Enforces CCPA maximum withholding caps (50% for employee supporting second family, 55% if in arrears >12 weeks; 60% if not supporting second family, 65% if in arrears).
 * - Multi-order priority ordering rules: Child Support -> Federal Tax Levy -> State Tax Levy -> Creditor Garnishment.
 *
 * @module GarnishmentModel
 * @version 7.1.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

export type GarnishmentOrderType = 'CHILD_SUPPORT' | 'FEDERAL_TAX_LEVY' | 'STATE_TAX_LEVY' | 'CREDITOR_GARNISHMENT' | 'STUDENT_LOAN';

export interface GarnishmentOrder {
  orderId: string;
  employeeId: string;
  orderType: GarnishmentOrderType;
  courtOrderNumber: string;
  stateJurisdiction: string;
  orderedAmountUsd: number; // Flat dollar or percentage
  isPercentage: boolean;
  percentageRate: number; // e.g. 25%
  supportsSecondFamily: boolean; // CCPA factor
  isInArrearsMoreThan12Weeks: boolean; // CCPA +5% factor
  priorityRank: number; // 1 = highest
}

export interface GarnishmentCalculationResult {
  orderId: string;
  orderType: GarnishmentOrderType;
  disposableEarningsUsd: number;
  maxCcpaCapUsd: number;
  actualWithheldUsd: number;
  remainingOrderBalanceUsd: number;
  isCappedByCcpa: boolean;
}

export class GarnishmentState {
  private orders: Map<string, GarnishmentOrder> = new Map();

  constructor() {
    this.loadDefaultOrders();
  }

  private loadDefaultOrders(): void {
    const defaultOrders: GarnishmentOrder[] = [
      {
        orderId: 'GARN-001',
        employeeId: 'EMP-GARN-101',
        orderType: 'CHILD_SUPPORT',
        courtOrderNumber: 'CS-2026-8891',
        stateJurisdiction: 'CA',
        orderedAmountUsd: 1200,
        isPercentage: false,
        percentageRate: 0,
        supportsSecondFamily: true,
        isInArrearsMoreThan12Weeks: false, // 50% CCPA cap
        priorityRank: 1
      },
      {
        orderId: 'GARN-002',
        employeeId: 'EMP-GARN-101',
        orderType: 'CREDITOR_GARNISHMENT',
        courtOrderNumber: 'CG-2026-1102',
        stateJurisdiction: 'CA',
        orderedAmountUsd: 500,
        isPercentage: false,
        percentageRate: 0,
        supportsSecondFamily: true,
        isInArrearsMoreThan12Weeks: false,
        priorityRank: 4
      }
    ];

    defaultOrders.forEach(o => this.orders.set(o.orderId, o));
  }

  public getOrders(): GarnishmentOrder[] {
    return Array.from(this.orders.values());
  }
}
