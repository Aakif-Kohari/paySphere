export interface BenefitPlanDTO {
    id: string;
    planName: string;
    providerName: string;
    planCategory: string;
    monthlyEmployerContributionUSD: number;
    monthlyEmployeeDeductionUSD: number;
    coveredEmployees: number;
    status: string;
}
export declare class EnterpriseBenefitsService {
    private plans;
    getPlans(): BenefitPlanDTO[];
    enrollEmployee(planId: string, employeeId: string): {
        success: boolean;
        effectiveDate: string;
    } | null;
}
declare const benefitsRouter: import("express-serve-static-core").Router;
export default benefitsRouter;
//# sourceMappingURL=EnterpriseBenefitsService.d.ts.map