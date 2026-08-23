export interface ContractorDTO {
    id: string;
    name: string;
    country: string;
    hourlyRateUSD: number;
    hoursBilledMonthly: number;
    monthlyGrossUSD: number;
    paymentMethod: string;
    payoutStatus: string;
}
export declare class ContractorDisbursementService {
    private contractors;
    getContractors(): ContractorDTO[];
    triggerContractorPayout(id: string): ContractorDTO | null;
}
declare const contractorRouter: import("express-serve-static-core").Router;
export default contractorRouter;
//# sourceMappingURL=ContractorDisbursementService.d.ts.map