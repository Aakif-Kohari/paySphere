export interface ReconciliationBatchDTO {
    id: string;
    batchName: string;
    bankPartner: string;
    totalDisbursedUSD: number;
    matchedTransactionsCount: number;
    unmatchedDiscrepanciesCount: number;
    varianceUSD: number;
    status: string;
}
export declare class EnterpriseReconciliationService {
    private batches;
    getBatches(): ReconciliationBatchDTO[];
    resolveDiscrepancy(id: string): {
        success: boolean;
        updatedStatus: string;
    } | null;
}
declare const reconcileRouter: import("express-serve-static-core").Router;
export default reconcileRouter;
//# sourceMappingURL=EnterpriseReconciliationService.d.ts.map