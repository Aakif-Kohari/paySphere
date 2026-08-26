/**
 * Enterprise Tax Protection (TP) vs Tax Equalization (TEQ) Policy Evaluator
 */

export interface PolicyComparisonResult {
  policyType: 'TAX_EQUALIZATION' | 'TAX_PROTECTION';
  employeeTaxBurdenUsd: number;
  employerGrossUpCostUsd: number;
}

export class TaxPolicyEvaluator {
  public static comparePolicies(
    homeTaxUsd: number,
    hostTaxUsd: number
  ): PolicyComparisonResult[] {
    // Tax Equalization: Employee pays exact homeTaxUsd regardless
    const teqEmployerCost = Math.max(0, hostTaxUsd - homeTaxUsd);

    // Tax Protection: Employee pays MIN(homeTaxUsd, hostTaxUsd). If hostTax < homeTax, employee keeps benefit
    const tpEmployeeTax = Math.min(homeTaxUsd, hostTaxUsd);
    const tpEmployerCost = Math.max(0, hostTaxUsd - homeTaxUsd);

    return [
      { policyType: 'TAX_EQUALIZATION', employeeTaxBurdenUsd: homeTaxUsd, employerGrossUpCostUsd: teqEmployerCost },
      { policyType: 'TAX_PROTECTION', employeeTaxBurdenUsd: tpEmployeeTax, employerGrossUpCostUsd: tpEmployerCost }
    ];
  }
}
