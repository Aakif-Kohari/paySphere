export interface TaxJurisdictionDTO {
    id: string;
    countryName: string;
    regionName: string;
    corporateTaxRate: number;
    payrollTaxRate: number;
    filingStatus: string;
    totalTaxesRemittedUSD: number;
}
export declare class MultiJurisdictionTaxService {
    private jurisdictions;
    getJurisdictions(): TaxJurisdictionDTO[];
    calculateTaxWithholding(grossSalaryUSD: number, countryCode: string): {
        corporateTax: number;
        payrollTax: number;
    };
}
declare const taxRouter: import("express-serve-static-core").Router;
export default taxRouter;
//# sourceMappingURL=MultiJurisdictionTaxService.d.ts.map