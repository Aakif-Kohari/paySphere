export interface BenefitPlan {
  id: string;
  planName: string;
  provider: string;
  category: 'health' | 'dental' | 'vision' | '401k' | 'life' | 'fsa';
  tier: 'silver' | 'gold' | 'platinum';
  employeeMonthlyCost: number;
  employerMonthlyMatch: number;
  coverageLimit: number;
  deductible: number;
  description: string;
  features: string[];
  enrollmentDeadline: string;
}

export interface BenefitEnrollment {
  id: string;
  planId: string;
  planName: string;
  category: string;
  employeeName: string;
  employeeId: string;
  dependentsCount: number;
  monthlyDeduction: number;
  status: 'active' | 'pending' | 'terminated';
  effectiveDate: string;
  renewalDate: string;
}

export interface BenefitFilterOptions {
  category: string;
  tier: string;
  maxMonthlyCost: number;
  searchQuery: string;
}

const INITIAL_PLANS: BenefitPlan[] = [
  {
    id: "plan-101",
    title: "", // compatibility
    planName: "Premier Health PPO Plan",
    provider: "BlueCross BlueShield",
    category: "health",
    tier: "platinum",
    employeeMonthlyCost: 150,
    employerMonthlyMatch: 450,
    coverageLimit: 1000000,
    deductible: 500,
    description: "Comprehensive medical coverage with zero copay for preventive care and low out-of-pocket maximums.",
    features: ["Zero Preventive Copay", "Worldwide Emergency Care", "Mental Health Coverage", "Telehealth 24/7"],
    enrollmentDeadline: "Dec 31, 2026",
  },
  {
    id: "plan-102",
    planName: "Comprehensive Dental Preferred",
    provider: "Delta Dental",
    category: "dental",
    tier: "gold",
    employeeMonthlyCost: 35,
    employerMonthlyMatch: 65,
    coverageLimit: 5000,
    deductible: 50,
    description: "Full dental coverage including orthodontia for dependents and semi-annual cleanings.",
    features: ["Orthodontia Included", "100% Diagnostic Coverage", "In-Network Savings"],
    enrollmentDeadline: "Dec 31, 2026",
  },
  {
    id: "plan-103",
    planName: "Vision Care Superior Plus",
    provider: "VSP Vision",
    category: "vision",
    tier: "silver",
    employeeMonthlyCost: 15,
    employerMonthlyMatch: 25,
    coverageLimit: 2000,
    deductible: 10,
    description: "Annual vision exams, frames allowance, and contact lens fitting discounts.",
    features: ["$200 Frame Allowance", "Free Laser Vision Consult", "Annual Exam Included"],
    enrollmentDeadline: "Dec 31, 2026",
  },
  {
    id: "plan-104",
    planName: "401(k) Executive Retirement Savings Plan",
    provider: "Fidelity Investments",
    category: "401k",
    tier: "platinum",
    employeeMonthlyCost: 0,
    employerMonthlyMatch: 6, // 6% match
    coverageLimit: 23000,
    deductible: 0,
    description: "Dollar-for-dollar employer matching up to 6% of base salary with immediate vesting.",
    features: ["6% Employer Match", "Immediate Vesting", "Target Date Funds", "Roth & Traditional Options"],
    enrollmentDeadline: "Open Enrollment",
  },
];

const INITIAL_ENROLLMENTS: BenefitEnrollment[] = [
  {
    id: "enr-201",
    planId: "plan-101",
    planName: "Premier Health PPO Plan",
    category: "health",
    employeeName: "Alex Mercer",
    employeeId: "EMP-4091",
    dependentsCount: 2,
    monthlyDeduction: 150,
    status: "active",
    effectiveDate: "Jan 1, 2026",
    renewalDate: "Dec 31, 2026",
  },
];

export class EnterpriseBenefitsService {
  private static plans: BenefitPlan[] = [...INITIAL_PLANS];
  private static enrollments: BenefitEnrollment[] = [...INITIAL_ENROLLMENTS];

  public static getPlans(options?: Partial<BenefitFilterOptions>): BenefitPlan[] {
    let result = [...this.plans];
    if (!options) return result;

    if (options.category && options.category !== "All") {
      result = result.filter((p) => p.category === options.category);
    }

    if (options.tier && options.tier !== "All") {
      result = result.filter((p) => p.tier === options.tier);
    }

    if (options.maxMonthlyCost && options.maxMonthlyCost > 0) {
      result = result.filter((p) => p.employeeMonthlyCost <= options.maxMonthlyCost);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.planName.toLowerCase().includes(q) ||
          p.provider.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.features.some((f) => f.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public static getPlanById(id: string): BenefitPlan | undefined {
    return this.plans.find((p) => p.id === id);
  }

  public static createPlan(
    plan: Omit<BenefitPlan, "id">
  ): BenefitPlan {
    const newPlan: BenefitPlan = {
      ...plan,
      id: `plan-${Date.now()}`,
    };
    this.plans.unshift(newPlan);
    return newPlan;
  }

  public static getEnrollments(): BenefitEnrollment[] {
    return [...this.enrollments];
  }

  public static enrollEmployee(
    planId: string,
    employeeName: string,
    employeeId: string,
    dependentsCount: number
  ): BenefitEnrollment {
    const plan = this.getPlanById(planId);
    if (!plan) throw new Error("Benefit plan not found.");

    const newEnrollment: BenefitEnrollment = {
      id: `enr-${Date.now()}`,
      planId,
      planName: plan.planName,
      category: plan.category,
      employeeName,
      employeeId,
      dependentsCount,
      monthlyDeduction: plan.employeeMonthlyCost,
      status: "active",
      effectiveDate: "Immediate",
      renewalDate: "Dec 31, 2026",
    };

    this.enrollments.unshift(newEnrollment);
    return newEnrollment;
  }

  public static terminateEnrollment(enrollmentId: string): boolean {
    const idx = this.enrollments.findIndex((e) => e.id === enrollmentId);
    if (idx !== -1) {
      this.enrollments[idx].status = "terminated";
      return true;
    }
    return false;
  }
}
