export interface EquityGrantDTO {
    id: string;
    granteeName: string;
    roleTitle: string;
    grantType: string;
    sharesGranted: number;
    strikePriceUSD: number;
    currentFairMarketValueUSD: number;
    vestingProgressPercent: number;
    status: string;
}
export declare class EnterpriseEquityService {
    private grants;
    getGrants(): EquityGrantDTO[];
    exerciseOptionGrant(id: string, sharesToExercise: number): {
        success: boolean;
        totalCostUSD: number;
        remainingShares: number;
    } | null;
}
declare const equityRouter: import("express-serve-static-core").Router;
export default equityRouter;
//# sourceMappingURL=EnterpriseEquityService.d.ts.map