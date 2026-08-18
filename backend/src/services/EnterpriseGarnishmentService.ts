import {
  EnterpriseGarnishmentService,
  GarnishmentOrder,
  GarnishmentDeduction,
  GarnishmentFilterOptions,
} from "../models/EnterpriseGarnishmentModel";

export class EnterpriseGarnishmentServiceHandler {
  public static fetchGarnishmentOrders(filters?: Partial<GarnishmentFilterOptions>): GarnishmentOrder[] {
    return EnterpriseGarnishmentService.getOrders(filters);
  }

  public static fetchOrderDetails(id: string): GarnishmentOrder | undefined {
    return EnterpriseGarnishmentService.getOrderById(id);
  }

  public static createNewGarnishmentOrder(payload: Omit<GarnishmentOrder, "id" | "status">): GarnishmentOrder {
    return EnterpriseGarnishmentService.createOrder(payload);
  }

  public static fetchDeductionHistory(): GarnishmentDeduction[] {
    return EnterpriseGarnishmentService.getDeductions();
  }

  public static processOrderDeduction(
    orderId: string,
    amountDeducted: number,
    payPeriod: string
  ): GarnishmentDeduction {
    return EnterpriseGarnishmentService.processGarnishmentDeduction(orderId, amountDeducted, payPeriod);
  }
}
