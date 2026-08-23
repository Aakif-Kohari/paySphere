export interface CurrencyVaultDTO {
    id: string;
    currencyCode: string;
    totalBalance: number;
    fxRateToUSD: number;
    hedgedPercentage: number;
    status: string;
}
export declare class MultiCurrencyTreasuryService {
    private vaults;
    getVaults(): CurrencyVaultDTO[];
    getVaultByCode(code: string): CurrencyVaultDTO | undefined;
    executeLiquiditySwap(fromCurrency: string, toCurrency: string, amount: number): {
        success: boolean;
        convertedUSD: number;
    };
    getDbVaults(tenantId: string): Promise<CurrencyVaultDTO[]>;
    executeDbLiquiditySwap(tenantId: string, fromCurrency: string, toCurrency: string, amount: number): Promise<{
        success: boolean;
        convertedUSD: number;
    }>;
}
declare const treasuryRouter: import("express-serve-static-core").Router;
export default treasuryRouter;
//# sourceMappingURL=MultiCurrencyTreasuryService.d.ts.map