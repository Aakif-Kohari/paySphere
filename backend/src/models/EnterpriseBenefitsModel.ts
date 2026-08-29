export interface BenefitEnrollmentDTO {
  enrollmentId: string;
  employeeId: string;
  planId: string;
  selectedTier: string;
  monthlyDeductionUSD: number;
  isEDITransmitted: boolean;
}

export class EnterpriseBenefitsModel {
  public planId: string;
  public planName: string;
  public carrierProvider: string;
  public category: 'Medical' | 'Dental' | 'Vision' | '401k' | 'LifeInsurance';
  public employerContributionUSD: number;
  public employeeDeductionUSD: number;
  public enrolledCount: number;
  public annualDeductibleUSD: number;
  public activeEnrollments: BenefitEnrollmentDTO[];
  public isERISACompliant: boolean;
  public createdAt: string;

  constructor(data: Partial<EnterpriseBenefitsModel>) {
    this.planId = data.planId || `plan_${Math.random().toString(36).substr(2, 9)}`;
    this.planName = data.planName || 'Comprehensive Health Plan';
    this.carrierProvider = data.carrierProvider || 'National Healthcare Corp';
    this.category = data.category || 'Medical';
    this.employerContributionUSD = data.employerContributionUSD || 500;
    this.employeeDeductionUSD = data.employeeDeductionUSD || 100;
    this.enrolledCount = data.enrolledCount || 50;
    this.annualDeductibleUSD = data.annualDeductibleUSD || 250;
    this.activeEnrollments = data.activeEnrollments || [];
    this.isERISACompliant = data.isERISACompliant ?? true;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      planId: this.planId,
      planName: this.planName,
      carrierProvider: this.carrierProvider,
      category: this.category,
      employerContributionUSD: this.employerContributionUSD,
      employeeDeductionUSD: this.employeeDeductionUSD,
      enrolledCount: this.enrolledCount,
      annualDeductibleUSD: this.annualDeductibleUSD,
      activeEnrollments: this.activeEnrollments,
      isERISACompliant: this.isERISACompliant,
      createdAt: this.createdAt,
    };
  }
}
