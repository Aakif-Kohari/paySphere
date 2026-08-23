export interface DepartmentPayrollDTO {
    id: string;
    departmentName: string;
    headcount: number;
    monthlyGrossUSD: number;
    taxWithholdingsUSD: number;
    benefitsContributionUSD: number;
    netDisbursementUSD: number;
    status: 'DISBURSED' | 'PROCESSING' | 'FLAGGED';
}
export declare class EnterprisePayrollService {
    private departments;
    getPayrollMetrics(): DepartmentPayrollDTO[];
    getDepartmentById(id: string): DepartmentPayrollDTO | undefined;
    triggerDisbursement(id: string): DepartmentPayrollDTO | null;
}
declare const payrollRouter: import("express-serve-static-core").Router;
export default payrollRouter;
//# sourceMappingURL=EnterprisePayrollService.d.ts.map