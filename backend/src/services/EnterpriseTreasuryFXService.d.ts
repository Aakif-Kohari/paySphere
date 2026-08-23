export interface ForexSwapDTO {
    id: string;
    pairName: string;
    baseCurrency: string;
    quoteCurrency: string;
    spotRate: number;
    notionalAmountBaseUSD: number;
    liquidityProvider: string;
    status: string;
}
export declare class EnterpriseTreasuryFXService {
    private swaps;
    getSwaps(): ForexSwapDTO[];
    executeSwapContract(id: string): {
        success: boolean;
        executedRate: number;
        settlementId: string;
    } | null;
}
declare const fxRouter: import("express-serve-static-core").Router;
export default fxRouter;
//# sourceMappingURL=EnterpriseTreasuryFXService.d.ts.map