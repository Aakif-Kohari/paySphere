/**
 * Enterprise Payroll Garnishment & Child Support Withholding Service Engine
 * 
 * Architectural Specifications:
 * - Calculates Disposable Earnings (Gross Earnings minus mandatory statutory deductions: FICA, Federal/State Tax).
 * - Enforces CCPA (Consumer Credit Protection Act) Title III Withholding Caps:
 *   - 50%: Supporting second spouse/child, not in arrears.
 *   - 55%: Supporting second spouse/child, in arrears > 12 weeks.
 *   - 60%: Not supporting second spouse/child, not in arrears.
 *   - 65%: Not supporting second spouse/child, in arrears > 12 weeks.
 *   - 25%: Standard Creditor Garnishment cap (lesser of 25% disposable earnings or amount over 30x federal min wage).
 * - Multi-order priority allocation engine.
 *
 * @module GarnishmentService
 * @version 7.1.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import {
  GarnishmentOrder,
  GarnishmentCalculationResult,
  GarnishmentState
} from './GarnishmentModel';

export class GarnishmentService {
  private state: GarnishmentState;

  constructor(state?: GarnishmentState) {
    this.state = state || new GarnishmentState();
  }

  public getState(): GarnishmentState {
    return this.state;
  }

  /**
   * Calculates CCPA maximum allowable withholding percentage cap.
   */
  public calculateCcpaCapPercentage(order: GarnishmentOrder): number {
    if (order.orderType === 'CREDITOR_GARNISHMENT') {
      return 0.25; // 25% max for general creditor garnishments
    }

    if (order.supportsSecondFamily) {
      return order.isInArrearsMoreThan12Weeks ? 0.55 : 0.50;
    } else {
      return order.isInArrearsMoreThan12Weeks ? 0.65 : 0.60;
    }
  }

  /**
   * Calculates garnishment withholding for a list of prioritized court orders.
   */
  public calculateGarnishmentWithholding(
    grossEarningsUsd: number,
    mandatoryDeductionsUsd: number,
    orders: GarnishmentOrder[]
  ): GarnishmentCalculationResult[] {
    const disposableEarningsUsd = Math.max(0, grossEarningsUsd - mandatoryDeductionsUsd);

    // Sort orders by priority rank ascending (1 = highest priority)
    const sortedOrders = [...orders].sort((a, b) => a.priorityRank - b.priorityRank);
    const results: GarnishmentCalculationResult[] = [];

    let totalWithheldSoFarUsd = 0;

    for (const order of sortedOrders) {
      const capPercent = this.calculateCcpaCapPercentage(order);
      const maxCcpaCapUsd = disposableEarningsUsd * capPercent;

      let requestedAmountUsd = order.isPercentage
        ? disposableEarningsUsd * (order.percentageRate / 100)
        : order.orderedAmountUsd;

      // Available room under CCPA cap
      const availableRoomUsd = Math.max(0, maxCcpaCapUsd - totalWithheldSoFarUsd);

      let actualWithheldUsd = Math.min(requestedAmountUsd, availableRoomUsd);
      const isCappedByCcpa = actualWithheldUsd < requestedAmountUsd;

      totalWithheldSoFarUsd += actualWithheldUsd;

      results.push({
        orderId: order.orderId,
        orderType: order.orderType,
        disposableEarningsUsd: Number(disposableEarningsUsd.toFixed(2)),
        maxCcpaCapUsd: Number(maxCcpaCapUsd.toFixed(2)),
        actualWithheldUsd: Number(actualWithheldUsd.toFixed(2)),
        remainingOrderBalanceUsd: Number((requestedAmountUsd - actualWithheldUsd).toFixed(2)),
        isCappedByCcpa
      });
    }

    return results;
  }
}
