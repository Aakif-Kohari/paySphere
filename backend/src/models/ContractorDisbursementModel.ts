export interface W8BENAuditDetails {
  formId: string;
  taxIdentityNumber: string;
  countryOfResidence: string;
  isVerified: boolean;
  expiresAt: string;
}

export class ContractorPayoutModel {
  public contractorId: string;
  public fullName: string;
  public professionalTitle: string;
  public residencyCountry: string;
  public hourlyRateUSD: number;
  public hoursBilled: number;
  public totalGrossInvoiceUSD: number;
  public taxAudit: W8BENAuditDetails;
  public payoutGateway: string;
  public status: 'SCHEDULED' | 'PROCESSING' | 'PAID' | 'FAILED';
  public createdAt: string;

  constructor(data: Partial<ContractorPayoutModel>) {
    this.contractorId = data.contractorId || `cntr_${Math.random().toString(36).substr(2, 9)}`;
    this.fullName = data.fullName || 'Contractor Professional';
    this.professionalTitle = data.professionalTitle || 'Software Engineer';
    this.residencyCountry = data.residencyCountry || 'United States';
    this.hourlyRateUSD = data.hourlyRateUSD || 100;
    this.hoursBilled = data.hoursBilled || 160;
    this.totalGrossInvoiceUSD = this.hourlyRateUSD * this.hoursBilled;
    this.taxAudit = data.taxAudit || {
      formId: 'W8-BEN-2026-901',
      taxIdentityNumber: 'XX-XXX1234',
      countryOfResidence: this.residencyCountry,
      isVerified: true,
      expiresAt: new Date(Date.now() + 31536000000).toISOString(),
    };
    this.payoutGateway = data.payoutGateway || 'SWIFT Wire';
    this.status = data.status || 'SCHEDULED';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      contractorId: this.contractorId,
      fullName: this.fullName,
      professionalTitle: this.professionalTitle,
      residencyCountry: this.residencyCountry,
      hourlyRateUSD: this.hourlyRateUSD,
      hoursBilled: this.hoursBilled,
      totalGrossInvoiceUSD: this.totalGrossInvoiceUSD,
      taxAudit: this.taxAudit,
      payoutGateway: this.payoutGateway,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}
