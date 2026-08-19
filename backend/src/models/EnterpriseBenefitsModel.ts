// Enterprise Benefits & Compensation Management Suite — Data Models
// Covers benefits plans, employee enrollments, compensation bands, and total rewards

export type PlanType = 'health_insurance' | 'dental' | 'vision' | 'life_insurance' | 'disability' | 'retirement_401k' | 'hsa' | 'commuter' | 'wellness' | 'tuition_reimbursement';
export type PlanTier = 'individual' | 'couple' | 'family';
export type EnrollmentStatus = 'active' | 'pending' | 'terminated' | 'cobra' | 'waived';
export type PayFrequency = 'biweekly' | 'monthly' | 'semimonthly' | 'weekly';
export type CompensationGrade = 'executive' | 'director' | 'senior_manager' | 'manager' | 'senior_individual' | 'individual' | 'junior' | 'intern';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF';

export interface IBenefitsPlan {
  id: string;
  name: string;
  type: PlanType;
  provider: string;
  description: string;
  tiers: Array<{
    tier: PlanTier;
    monthlyPremium: number;
    annualDeductible: number;
    outOfPocketMax: number;
    coinsurance: string;
  }>;
  coverageEffectiveDate: string;
  openEnrollmentStart: string;
  openEnrollmentEnd: string;
  features: string[];
  networkType: string;
  isHSAEligible: boolean;
  isActive: boolean;
}

export interface IBenefitsEnrollment {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  planId: string;
  planName: string;
  planType: PlanType;
  selectedTier: PlanTier;
  status: EnrollmentStatus;
  monthlyPremium: number;
  employerContribution: number;
  employeeContribution: number;
  effectiveDate: string;
  terminationDate: string | null;
  dependents: Array<{ name: string; relationship: string; dateOfBirth: string }>;
  hsaBalance: number | null;
  ytdEmployerSpend: number;
  enrolledAt: string;
}

export interface ICompensationBand {
  id: string;
  grade: CompensationGrade;
  title: string;
  minSalary: number;
  midpoint: number;
  maxSalary: number;
  currency: CurrencyCode;
  location: string;
  marketPercentile25: number;
  marketPercentile50: number;
  marketPercentile75: number;
  equityRange: { min: number; max: number; type: 'rsu' | 'options' | 'none' };
  bonusTarget: number;
  benefitsValue: number;
  totalCompRange: { min: number; max: number };
  lastUpdated: string;
  headcount: number;
}

export interface ITotalRewardsStatement {
  employeeId: string;
  employeeName: string;
  department: string;
  compensationGrade: string;
  baseSalary: number;
  bonus: number;
  equity: number;
  benefitsValue: number;
  retirementMatch: number;
  perksAllowance: number;
  totalCompensation: number;
  currency: CurrencyCode;
  year: number;
  breakdown: Array<{
    category: string;
    amount: number;
    employerPaid: boolean;
  }>;
}

// Factory: generates realistic benefits plans
export function createMockBenefitsPlans(): IBenefitsPlan[] {
  return [
    {
      id: 'BP-001', name: 'Pinnacle Health Premium', type: 'health_insurance', provider: 'Pinnacle Health',
      description: 'Comprehensive health plan with nationwide coverage, preventive care, and mental health support.',
      tiers: [
        { tier: 'individual', monthlyPremium: 450, annualDeductible: 500, outOfPocketMax: 3000, coinsurance: '80/20' },
        { tier: 'couple', monthlyPremium: 900, annualDeductible: 750, outOfPocketMax: 5000, coinsurance: '80/20' },
        { tier: 'family', monthlyPremium: 1350, annualDeductible: 1000, outOfPocketMax: 7000, coinsurance: '80/20' },
      ],
      coverageEffectiveDate: '2026-01-01', openEnrollmentStart: '2025-11-01', openEnrollmentEnd: '2025-11-30',
      features: ['Telehealth included', 'Mental health: 60 visits/year', 'Prescription drug coverage', 'No referral needed for specialists'],
      networkType: 'PPO', isHSAEligible: false, isActive: true,
    },
    {
      id: 'BP-002', name: 'Delta Dental Premier', type: 'dental', provider: 'Delta Dental',
      description: 'Full-service dental covering preventive, basic, and major procedures with orthodontia benefits.',
      tiers: [
        { tier: 'individual', monthlyPremium: 45, annualDeductible: 50, outOfPocketMax: 2000, coinsurance: '90/10' },
        { tier: 'couple', monthlyPremium: 90, annualDeductible: 75, outOfPocketMax: 3500, coinsurance: '90/10' },
        { tier: 'family', monthlyPremium: 135, annualDeductible: 100, outOfPocketMax: 5000, coinsurance: '90/10' },
      ],
      coverageEffectiveDate: '2026-01-01', openEnrollmentStart: '2025-11-01', openEnrollmentEnd: '2025-11-30',
      features: ['2 cleanings/year covered 100%', 'Orthodontia up to $2,500 lifetime', 'Cosmetic discount program'],
      networkType: 'PPO', isHSAEligible: false, isActive: true,
    },
    {
      id: 'BP-003', name: 'VSP Vision Plus', type: 'vision', provider: 'VSP',
      description: 'Vision coverage including annual eye exams, frames, and LASIK discount program.',
      tiers: [
        { tier: 'individual', monthlyPremium: 18, annualDeductible: 0, outOfPocketMax: 500, coinsurance: '100/0' },
        { tier: 'couple', monthlyPremium: 36, annualDeductible: 0, outOfPocketMax: 800, coinsurance: '100/0' },
        { tier: 'family', monthlyPremium: 54, annualDeductible: 0, outOfPocketMax: 1000, coinsurance: '100/0' },
      ],
      coverageEffectiveDate: '2026-01-01', openEnrollmentStart: '2025-11-01', openEnrollmentEnd: '2025-11-30',
      features: ['Annual exam covered 100%', '$150 frame allowance', '20% LASIK discount', 'Contact lens allowance $120'],
      networkType: 'PPO', isHSAEligible: false, isActive: true,
    },
    {
      id: 'BP-004', name: 'SecureLife Term 500K', type: 'life_insurance', provider: 'MetLife',
      description: 'Employer-paid basic life with supplemental options up to 5x salary.',
      tiers: [
        { tier: 'individual', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: '100/0' },
        { tier: 'couple', monthlyPremium: 12, annualDeductible: 0, outOfPocketMax: 0, coinsurance: '100/0' },
        { tier: 'family', monthlyPremium: 24, annualDeductible: 0, outOfPocketMax: 0, coinsurance: '100/0' },
      ],
      coverageEffectiveDate: '2026-01-01', openEnrollmentStart: '2025-11-01', openEnrollmentEnd: '2025-11-30',
      features: ['Employer-paid $50K base', 'Supplemental up to 5x salary', 'AD&D included', 'Beneficiary designation portal'],
      networkType: 'N/A', isHSAEligible: false, isActive: true,
    },
    {
      id: 'BP-005', name: 'SecureFuture 401(k)', type: 'retirement_401k', provider: 'Fidelity',
      description: '401(k) with employer match up to 6% and auto-escalation feature.',
      tiers: [
        { tier: 'individual', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: 'N/A' },
        { tier: 'couple', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: 'N/A' },
        { tier: 'family', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: 'N/A' },
      ],
      coverageEffectiveDate: '2026-01-01', openEnrollmentStart: '2025-11-01', openEnrollmentEnd: '2025-11-30',
      features: ['6% employer match', 'Auto-escalation 1%/year', 'Roth option available', 'Vesting: 3-year cliff'],
      networkType: 'N/A', isHSAEligible: false, isActive: true,
    },
    {
      id: 'BP-006', name: 'WellnessPlus Program', type: 'wellness', provider: 'Virgin Pulse',
      description: 'Comprehensive wellness program with gym reimbursement, mental health, and EAP.',
      tiers: [
        { tier: 'individual', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: 'N/A' },
        { tier: 'couple', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: 'N/A' },
        { tier: 'family', monthlyPremium: 0, annualDeductible: 0, outOfPocketMax: 0, coinsurance: 'N/A' },
      ],
      coverageEffectiveDate: '2026-01-01', openEnrollmentStart: '2025-11-01', openEnrollmentEnd: '2025-11-30',
      features: ['$100/month gym reimbursement', 'EAP: unlimited sessions', 'Meditation app subscription', 'Annual wellness challenge'],
      networkType: 'N/A', isHSAEligible: false, isActive: true,
    },
  ];
}

// Factory: generates realistic employee enrollments
export function createMockEnrollments(): IBenefitsEnrollment[] {
  return [
    { id: 'ENR-001', employeeId: 'EMP-101', employeeName: 'Sarah Chen', department: 'Engineering', planId: 'BP-001', planName: 'Pinnacle Health Premium', planType: 'health_insurance', selectedTier: 'family', status: 'active', monthlyPremium: 1350, employerContribution: 1080, employeeContribution: 270, effectiveDate: '2026-01-01', terminationDate: null, dependents: [{ name: 'David Chen', relationship: 'spouse', dateOfBirth: '1988-03-12' }, { name: 'Mia Chen', relationship: 'child', dateOfBirth: '2020-07-15' }], hsaBalance: null, ytdEmployerSpend: 12960, enrolledAt: '2025-11-15T10:00:00Z' },
    { id: 'ENR-002', employeeId: 'EMP-102', employeeName: 'Marcus Weber', department: 'Product', planId: 'BP-001', planName: 'Pinnacle Health Premium', planType: 'health_insurance', selectedTier: 'individual', status: 'active', monthlyPremium: 450, employerContribution: 360, employeeContribution: 90, effectiveDate: '2026-01-01', terminationDate: null, dependents: [], hsaBalance: null, ytdEmployerSpend: 4320, enrolledAt: '2025-11-12T14:30:00Z' },
    { id: 'ENR-003', employeeId: 'EMP-103', employeeName: 'Priya Patel', department: 'Finance', planId: 'BP-004', planName: 'SecureLife Term 500K', planType: 'life_insurance', selectedTier: 'family', status: 'active', monthlyPremium: 24, employerContribution: 24, employeeContribution: 0, effectiveDate: '2026-01-01', terminationDate: null, dependents: [{ name: 'Raj Patel', relationship: 'spouse', dateOfBirth: '1985-11-08' }], hsaBalance: null, ytdEmployerSpend: 288, enrolledAt: '2025-11-10T09:15:00Z' },
    { id: 'ENR-004', employeeId: 'EMP-104', employeeName: 'James Hartley', department: 'Marketing', planId: 'BP-005', planName: 'SecureFuture 401(k)', planType: 'retirement_401k', selectedTier: 'individual', status: 'active', monthlyPremium: 0, employerContribution: 0, employeeContribution: 0, effectiveDate: '2026-01-01', terminationDate: null, dependents: [], hsaBalance: null, ytdEmployerSpend: 0, enrolledAt: '2025-11-08T11:00:00Z' },
    { id: 'ENR-005', employeeId: 'EMP-105', employeeName: 'Yuki Tanaka', department: 'Engineering', planId: 'BP-001', planName: 'Pinnacle Health Premium', planType: 'health_insurance', selectedTier: 'couple', status: 'active', monthlyPremium: 900, employerContribution: 720, employeeContribution: 180, effectiveDate: '2026-01-01', terminationDate: null, dependents: [{ name: 'Aiko Tanaka', relationship: 'spouse', dateOfBirth: '1992-05-20' }], hsaBalance: null, ytdEmployerSpend: 8640, enrolledAt: '2025-11-18T08:45:00Z' },
    { id: 'ENR-006', employeeId: 'EMP-106', employeeName: 'Liam O\'Brien', department: 'Operations', planId: 'BP-006', planName: 'WellnessPlus Program', planType: 'wellness', selectedTier: 'individual', status: 'active', monthlyPremium: 0, employerContribution: 0, employeeContribution: 0, effectiveDate: '2026-01-01', terminationDate: null, dependents: [], hsaBalance: 3200, ytdEmployerSpend: 0, enrolledAt: '2025-11-20T16:00:00Z' },
  ];
}

// Factory: generates compensation bands
export function createMockCompensationBands(): ICompensationBand[] {
  return [
    { id: 'CB-001', grade: 'executive', title: 'VP / C-Suite', minSalary: 250000, midpoint: 350000, maxSalary: 500000, currency: 'USD', location: 'San Francisco', marketPercentile25: 280000, marketPercentile50: 350000, marketPercentile75: 420000, equityRange: { min: 100000, max: 300000, type: 'rsu' }, bonusTarget: 50, benefitsValue: 45000, totalCompRange: { min: 400000, max: 900000 }, lastUpdated: '2026-01-01', headcount: 8 },
    { id: 'CB-002', grade: 'director', title: 'Director', minSalary: 180000, midpoint: 220000, maxSalary: 280000, currency: 'USD', location: 'San Francisco', marketPercentile25: 190000, marketPercentile50: 220000, marketPercentile75: 260000, equityRange: { min: 50000, max: 150000, type: 'rsu' }, bonusTarget: 35, benefitsValue: 38000, totalCompRange: { min: 280000, max: 500000 }, lastUpdated: '2026-01-01', headcount: 22 },
    { id: 'CB-003', grade: 'senior_manager', title: 'Senior Manager', minSalary: 145000, midpoint: 175000, maxSalary: 210000, currency: 'USD', location: 'New York', marketPercentile25: 150000, marketPercentile50: 175000, marketPercentile75: 200000, equityRange: { min: 25000, max: 75000, type: 'rsu' }, bonusTarget: 25, benefitsValue: 32000, totalCompRange: { min: 210000, max: 340000 }, lastUpdated: '2026-01-01', headcount: 45 },
    { id: 'CB-004', grade: 'manager', title: 'Manager', minSalary: 120000, midpoint: 145000, maxSalary: 175000, currency: 'USD', location: 'New York', marketPercentile25: 125000, marketPercentile50: 145000, marketPercentile75: 165000, equityRange: { min: 15000, max: 50000, type: 'rsu' }, bonusTarget: 20, benefitsValue: 28000, totalCompRange: { min: 165000, max: 260000 }, lastUpdated: '2026-01-01', headcount: 78 },
    { id: 'CB-005', grade: 'senior_individual', title: 'Senior Individual Contributor', minSalary: 100000, midpoint: 130000, maxSalary: 160000, currency: 'USD', location: 'Austin', marketPercentile25: 108000, marketPercentile50: 130000, marketPercentile75: 152000, equityRange: { min: 10000, max: 35000, type: 'rsu' }, bonusTarget: 15, benefitsValue: 25000, totalCompRange: { min: 140000, max: 225000 }, lastUpdated: '2026-01-01', headcount: 156 },
    { id: 'CB-006', grade: 'individual', title: 'Individual Contributor', minSalary: 75000, midpoint: 95000, maxSalary: 120000, currency: 'USD', location: 'Austin', marketPercentile25: 80000, marketPercentile50: 95000, marketPercentile75: 112000, equityRange: { min: 5000, max: 20000, type: 'rsu' }, bonusTarget: 10, benefitsValue: 22000, totalCompRange: { min: 100000, max: 165000 }, lastUpdated: '2026-01-01', headcount: 312 },
  ];
}

// Aggregation: total benefits spend
export function computeBenefitsSpend(enrollments: IBenefitsEnrollment[]): { totalEmployerSpend: number; totalEmployeeSpend: number; activeEnrollments: number } {
  const active = enrollments.filter((e) => e.status === 'active');
  return {
    totalEmployerSpend: active.reduce((s, e) => s + e.ytdEmployerSpend, 0),
    totalEmployeeSpend: active.reduce((s, e) => s + e.employeeContribution * 12, 0),
    activeEnrollments: active.length,
  };
}

// Aggregation: enrollment breakdown by plan type
export function computeEnrollmentByType(enrollments: IBenefitsEnrollment[]): Array<{ type: PlanType; count: number; totalPremium: number }> {
  const map = new Map<PlanType, { count: number; totalPremium: number }>();
  for (const e of enrollments) {
    const existing = map.get(e.planType) || { count: 0, totalPremium: 0 };
    map.set(e.planType, { count: existing.count + 1, totalPremium: existing.totalPremium + e.monthlyPremium });
  }
  return Array.from(map.entries()).map(([type, data]) => ({ type, ...data }));
}
