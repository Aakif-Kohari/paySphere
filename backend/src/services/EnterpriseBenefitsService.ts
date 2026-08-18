import {
  EnterpriseBenefitsService,
  BenefitPlan,
  BenefitEnrollment,
  BenefitFilterOptions,
} from "../models/EnterpriseBenefitsModel";

export class EnterpriseBenefitsServiceHandler {
  public static fetchBenefitPlans(filters?: Partial<BenefitFilterOptions>): BenefitPlan[] {
    return EnterpriseBenefitsService.getPlans(filters);
  }

  public static fetchPlanDetails(id: string): BenefitPlan | undefined {
    return EnterpriseBenefitsService.getPlanById(id);
  }

  public static createNewBenefitPlan(payload: Omit<BenefitPlan, "id">): BenefitPlan {
    return EnterpriseBenefitsService.createPlan(payload);
  }

  public static fetchUserEnrollments(): BenefitEnrollment[] {
    return EnterpriseBenefitsService.getEnrollments();
  }

  public static submitEnrollment(
    planId: string,
    employeeName: string,
    employeeId: string,
    dependentsCount: number
  ): BenefitEnrollment {
    return EnterpriseBenefitsService.enrollEmployee(planId, employeeName, employeeId, dependentsCount);
  }

  public static cancelEnrollment(enrollmentId: string): boolean {
    return EnterpriseBenefitsService.terminateEnrollment(enrollmentId);
  }
}
