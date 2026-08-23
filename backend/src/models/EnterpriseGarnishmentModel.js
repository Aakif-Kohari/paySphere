"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseGarnishmentService = void 0;
const INITIAL_ORDERS = [
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
const INITIAL_DEDUCTIONS = [
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
class EnterpriseGarnishmentService {
    static orders = [...INITIAL_ORDERS];
    static deductions = [...INITIAL_DEDUCTIONS];
    static getOrders(options) {
        let result = [...this.orders];
        if (!options)
            return result;
        if (options.garnishmentType && options.garnishmentType !== "All") {
            result = result.filter((o) => o.garnishmentType === options.garnishmentType);
        }
        if (options.status && options.status !== "All") {
            result = result.filter((o) => o.status === options.status);
        }
        if (options.searchQuery && options.searchQuery.trim() !== "") {
            const q = options.searchQuery.toLowerCase().trim();
            result = result.filter((o) => o.employeeName.toLowerCase().includes(q) ||
                o.caseNumber.toLowerCase().includes(q) ||
                o.issuingAgency.toLowerCase().includes(q));
        }
        return result;
    }
    static getOrderById(id) {
        return this.orders.find((o) => o.id === id);
    }
    static createOrder(order) {
        const newOrder = {
            ...order,
            id: `garn-${Date.now()}`,
            status: "active",
        };
        this.orders.unshift(newOrder);
        return newOrder;
    }
    static getDeductions() {
        return [...this.deductions];
    }
    static processGarnishmentDeduction(orderId, amountDeducted, payPeriod) {
        const order = this.getOrderById(orderId);
        if (!order)
            throw new Error("Garnishment order not found.");
        const newDeduction = {
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
exports.EnterpriseGarnishmentService = EnterpriseGarnishmentService;
//# sourceMappingURL=EnterpriseGarnishmentModel.js.map