export interface GarnishmentOrder {
  id: string;
  employeeName: string;
  employeeId: string;
  garnishmentType: 'child-support' | 'tax-levy' | 'student-loan' | 'creditor-judgement';
  issuingAgency: string;
  caseNumber: string;
  totalOrderAmount: number;
  monthlyDeductionCap: number;
  priorityLevel: number;
  status: 'active' | 'fulfilled' | 'suspended';
  issuedDate: string;
  notes: string;
}

export interface GarnishmentDeduction {
  id: string;
  orderId: string;
  caseNumber: string;
  employeeName: string;
  amountDeducted: number;
  disbursementAgency: string;
  payPeriod: string;
  status: 'disbursed' | 'pending-disbursement' | 'held';
  processedDate: string;
}

export interface GarnishmentFilterOptions {
  garnishmentType: string;
  status: string;
  searchQuery: string;
}

const INITIAL_ORDERS: GarnishmentOrder[] = [
  {
    id: "garn-101",
    employeeName: "Marcus Vance",
    employeeId: "EMP-3012",
    garnishmentType: "child-support",
    issuingAgency: "California Dept of Child Support Services (DCSS)",
    caseNumber: "CS-994821",
    totalOrderAmount: 12000,
    monthlyDeductionCap: 600,
    priorityLevel: 1,
    status: "active",
    issuedDate: "Jan 15, 2026",
    notes: "Mandatory court-ordered child support withholding under CCPA 50% Disposable Earnings limit.",
  },
  {
    id: "garn-102",
    employeeName: "Elena Rostova",
    employeeId: "EMP-8841",
    garnishmentType: "tax-levy",
    issuingAgency: "Internal Revenue Service (IRS)",
    caseNumber: "IRS-TL-77410",
    totalOrderAmount: 8500,
    monthlyDeductionCap: 450,
    priorityLevel: 2,
    status: "active",
    issuedDate: "Feb 01, 2026",
    notes: "Federal tax levy withholding order.",
  },
  {
    id: "garn-103",
    employeeName: "Sophia Chen",
    employeeId: "EMP-2049",
    garnishmentType: "student-loan",
    issuingAgency: "US Department of Education",
    caseNumber: "SL-55109",
    totalOrderAmount: 4200,
    monthlyDeductionCap: 250,
    priorityLevel: 3,
    status: "active",
    issuedDate: "Mar 10, 2026",
    notes: "Administrative wage garnishment for defaulted federal student loans.",
  },
];

const INITIAL_DEDUCTIONS: GarnishmentDeduction[] = [
  {
    id: "ded-201",
    orderId: "garn-101",
    caseNumber: "CS-994821",
    employeeName: "Marcus Vance",
    amountDeducted: 300,
    disbursementAgency: "California DCSS State Disbursement Unit",
    payPeriod: "Aug 1 - Aug 15, 2026",
    status: "disbursed",
    processedDate: "Aug 15, 2026",
  },
];

export class EnterpriseGarnishmentService {
  private static orders: GarnishmentOrder[] = [...INITIAL_ORDERS];
  private static deductions: GarnishmentDeduction[] = [...INITIAL_DEDUCTIONS];

  public static getOrders(options?: Partial<GarnishmentFilterOptions>): GarnishmentOrder[] {
    let result = [...this.orders];
    if (!options) return result;

    if (options.garnishmentType && options.garnishmentType !== "All") {
      result = result.filter((o) => o.garnishmentType === options.garnishmentType);
    }

    if (options.status && options.status !== "All") {
      result = result.filter((o) => o.status === options.status);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.employeeName.toLowerCase().includes(q) ||
          o.caseNumber.toLowerCase().includes(q) ||
          o.issuingAgency.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public static getOrderById(id: string): GarnishmentOrder | undefined {
    return this.orders.find((o) => o.id === id);
  }

  public static createOrder(
    order: Omit<GarnishmentOrder, "id" | "status">
  ): GarnishmentOrder {
    const newOrder: GarnishmentOrder = {
      ...order,
      id: `garn-${Date.now()}`,
      status: "active",
    };
    this.orders.unshift(newOrder);
    return newOrder;
  }

  public static getDeductions(): GarnishmentDeduction[] {
    return [...this.deductions];
  }

  public static processGarnishmentDeduction(
    orderId: string,
    amountDeducted: number,
    payPeriod: string
  ): GarnishmentDeduction {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error("Garnishment order not found.");

    const newDeduction: GarnishmentDeduction = {
      id: `ded-${Date.now()}`,
      orderId,
      caseNumber: order.caseNumber,
      employeeName: order.employeeName,
      amountDeducted,
      disbursementAgency: order.issuingAgency,
      payPeriod,
      status: "disbursed",
      processedDate: "Just now",
    };

    this.deductions.unshift(newDeduction);
    return newDeduction;
  }
}
