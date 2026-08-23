export interface ForecastModelDTO {
    id: string;
    modelTitle: string;
    departmentScope: string;
    projectedQuarterlySpendUSD: number;
    varianceFromBudgetPercent: number;
    headcountDelta: number;
    confidenceScorePercent: number;
    scenarioType: string;
}
export declare class EnterpriseAnalyticsService {
    private models;
    getModels(): ForecastModelDTO[];
    runMonteCarloSimulation(id: string, iterations: number): {
        success: boolean;
        iterations: number;
        meanSpendUSD: number;
    } | null;
}
declare const analyticsRouter: import("express-serve-static-core").Router;
export default analyticsRouter;
//# sourceMappingURL=EnterpriseAnalyticsService.d.ts.map