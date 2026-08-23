// @ts-nocheck
import { Router, Request, Response } from 'express';

export interface BenefitPlanDTO {
  id: string;
  planName: string;
  providerName: string;
  planCategory: string;
  monthlyEmployerContributionUSD: number;
  monthlyEmployeeDeductionUSD: number;
  coveredEmployees: number;
  status: string;
}

export class EnterpriseBenefitsService {
  private plans: BenefitPlanDTO[] = [
    {
      id: 'plan-301',
      planName: 'Platinum PPO Healthcare & Vision',
      providerName: 'BlueCross BlueShield',
      planCategory: 'Medical & Health',
      monthlyEmployerContributionUSD: 650,
      monthlyEmployeeDeductionUSD: 120,
      coveredEmployees: 420,
      status: 'ACTIVE',
    },
    {
      id: 'plan-302',
      planName: 'Global Dental Premier',
      providerName: 'Delta Dental',
      planCategory: 'Dental Care',
      monthlyEmployerContributionUSD: 85,
      monthlyEmployeeDeductionUSD: 20,
      coveredEmployees: 395,
      status: 'ACTIVE',
    },
  ];

  public getPlans(): BenefitPlanDTO[] {
    return this.plans;
  }

  public enrollEmployee(planId: string, employeeId: string): { success: boolean; effectiveDate: string } | null {
    const plan = this.plans.find(p => p.id === planId);
    if (!plan) return null;
    plan.coveredEmployees += 1;
    return { success: true, effectiveDate: new Date().toISOString() };
  }
}

const benefitsService = new EnterpriseBenefitsService();
const benefitsRouter = Router();

benefitsRouter.get('/benefits/plans', (req: Request, res: Response) => {
  res.json({ success: true, data: benefitsService.getPlans() });
});

benefitsRouter.post('/benefits/plans/:id/enroll', (req: Request, res: Response) => {
  const { employeeId } = req.body;
  const result = benefitsService.enrollEmployee(req.params.id, employeeId);
  if (!result) return res.status(404).json({ success: false, error: 'Benefit plan not found' });
  res.json({ success: true, data: result });
});

export default benefitsRouter;
