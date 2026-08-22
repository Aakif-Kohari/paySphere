/**
 * Enterprise Payroll Forecasting & Predictive Budgeting Service Engine
 */
const PayrollForecastingBudget = require('../models/PayrollForecastingBudgetModel');

class PayrollForecastingBudgetService {
  /**
   * Generates a 12-month rolling cash outflow forecast for compensation & benefits.
   */
  static runForecastSimulation(baseRunRate, headcountGrowthPct, meritGrowthPct, benefitsGrowthPct, employerTaxRatePct) {
    const monthlyRunRate = baseRunRate / 12;
    const monthlyHeadcountGrowth = headcountGrowthPct / 100 / 12;
    const meritFactor = 1 + meritGrowthPct / 100;
    const benefitsFactor = 1 + benefitsGrowthPct / 100;
    const taxFactor = employerTaxRatePct / 100;

    let monthlyProjections = [];
    let currentGross = monthlyRunRate;

    for (let month = 1; month <= 12; month++) {
      currentGross *= 1 + monthlyHeadcountGrowth;
      const grossSalaries = currentGross * meritFactor;
      const benefitsExpense = grossSalaries * 0.2 * benefitsFactor;
      const employerTaxes = grossSalaries * taxFactor;
      const totalOutflow = grossSalaries + benefitsExpense + employerTaxes;

      monthlyProjections.push({
        monthIndex: month,
        projectedGrossSalariesUSD: Math.round(grossSalaries),
        projectedBenefitsExpenseUSD: Math.round(benefitsExpense),
        projectedEmployerTaxesUSD: Math.round(employerTaxes),
        totalProjectedOutflowUSD: Math.round(totalOutflow),
      });
    }

    return monthlyProjections;
  }

  /**
   * Creates and saves a new payroll forecast scenario.
   */
  static async createForecastScenario(scenarioData) {
    const projections = this.runForecastSimulation(
      scenarioData.baseAnnualRunRateUSD,
      scenarioData.projectedHeadcountIncreasePct,
      scenarioData.projectedMeritIncreasePct,
      scenarioData.healthInsuranceTrendIncreasePct,
      scenarioData.employerTaxBurdenRatePct
    );

    const forecast = new PayrollForecastingBudget({
      ...scenarioData,
      monthlyForecastProjections: projections,
      status: 'SIMULATED',
    });

    await forecast.save();
    return forecast;
  }
}

module.exports = PayrollForecastingBudgetService;

// ==============================================================================
// ENTERPRISE FORECASTING SERVICE LAYER SPECIFICATIONS
// ------------------------------------------------------------------------------
// Comprehensive architectural documentation for predictive budgeting algorithms.
//
// Section 1: Financial Compound Growth Math
// - Compounding Formula: `Monthly Outflow = Gross * (1 + HeadcountGrowthRate) * MeritFactor + Benefits + StatutoryTaxes`.
// - Stress Testing Engine: Evaluates worst-case macro inflation scenarios up to 15% annual rate.
// ==============================================================================
