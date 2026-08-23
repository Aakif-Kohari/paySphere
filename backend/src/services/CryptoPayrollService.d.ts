export interface CryptoWalletDTO {
    id: string;
    chainName: string;
    tokenSymbol: string;
    walletAddress: string;
    tokenBalance: number;
    usdEquivalent: number;
    status: string;
}
export declare class CryptoPayrollService {
    private wallets;
    getWallets(): CryptoWalletDTO[];
    disburseOnChain(recipientWallet: string, amountUSD: number, tokenSymbol: string): {
        success: boolean;
        txHash: string;
    };
}
declare const cryptoRouter: import("express-serve-static-core").Router;
export default cryptoRouter;
//# sourceMappingURL=CryptoPayrollService.d.ts.map