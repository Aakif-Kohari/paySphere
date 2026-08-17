export interface TaxFilingReceiptModel {
  filingId: string;
  formType: string;
  authorityName: string;
  taxAmountUSD: number;
  acknowledgmentCode: string;
  submittedAt: string;
}

export class TaxJurisdictionRuleModel {
  public jurisdictionId: string;
  public countryISO: string;
  public regionName: string;
  public corporateRatePercent: number;
  public employerPayrollRatePercent: number;
  public employeeWithholdingRatePercent: number;
  public statutoryFilingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  public filingReceipts: TaxFilingReceiptModel[];
  public isCompliant: boolean;
  public createdAt: string;

  constructor(data: Partial<TaxJurisdictionRuleModel>) {
    this.jurisdictionId = data.jurisdictionId || `juris_${Math.random().toString(36).substr(2, 9)}`;
    this.countryISO = data.countryISO || 'US';
    this.regionName = data.regionName || 'Federal Jurisdiction';
    this.corporateRatePercent = data.corporateRatePercent || 21.0;
    this.employerPayrollRatePercent = data.employerPayrollRatePercent || 15.3;
    this.employeeWithholdingRatePercent = data.employeeWithholdingRatePercent || 12.0;
    this.statutoryFilingFrequency = data.statutoryFilingFrequency || 'QUARTERLY';
    this.filingReceipts = data.filingReceipts || [];
    this.isCompliant = data.isCompliant ?? true;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      jurisdictionId: this.jurisdictionId,
      countryISO: this.countryISO,
      regionName: this.regionName,
      corporateRatePercent: this.corporateRatePercent,
      employerPayrollRatePercent: this.employerPayrollRatePercent,
      employeeWithholdingRatePercent: this.employeeWithholdingRatePercent,
      statutoryFilingFrequency: this.statutoryFilingFrequency,
      filingReceipts: this.filingReceipts,
      isCompliant: this.isCompliant,
      createdAt: this.createdAt,
    };
  }
}
