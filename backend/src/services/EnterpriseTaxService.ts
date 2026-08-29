// @ts-nocheck
import {
  EnterpriseTaxService,
  TaxBracket,
  TaxFilingRecord,
  TaxFilterOptions,
} from "../models/EnterpriseTaxModel";

export class EnterpriseTaxServiceHandler {
  public static fetchTaxBrackets(filters?: Partial<TaxFilterOptions>): TaxBracket[] {
    return EnterpriseTaxService.getBrackets(filters);
  }

  public static fetchTaxBracketDetails(id: string): TaxBracket | undefined {
    return EnterpriseTaxService.getBracketById(id);
  }

  public static createNewTaxBracket(payload: Omit<TaxBracket, "id">): TaxBracket {
    return EnterpriseTaxService.createTaxBracket(payload);
  }

  public static fetchTaxFilingRecords(): TaxFilingRecord[] {
    return EnterpriseTaxService.getTaxRecords();
  }

  public static processEmployeeTaxWithholding(
    employeeName: string,
    employeeId: string,
    stateJurisdiction: string,
    w4FilingStatus: 'single' | 'married-joint' | 'head-of-household',
    grossPay: number,
    payPeriod: string
  ): TaxFilingRecord {
    return EnterpriseTaxService.calculateAndProcessTaxWithholding(
      employeeName,
      employeeId,
      stateJurisdiction,
      w4FilingStatus,
      grossPay,
      payPeriod
    );
  }
}
