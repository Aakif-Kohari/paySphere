// @ts-nocheck
import { Router, Request, Response } from 'express';

export interface DepartmentPayrollDTO {
  id: string;
  departmentName: string;
  headcount: number;
  monthlyGrossUSD: number;
  taxWithholdingsUSD: number;
  benefitsContributionUSD: number;
  netDisbursementUSD: number;
  status: 'DISBURSED' | 'PROCESSING' | 'FLAGGED';
}

export class EnterprisePayrollService {
  private departments: DepartmentPayrollDTO[] = [
    {
      id: 'dept-101',
      departmentName: 'Engineering & Product Development',
      headcount: 142,
      monthlyGrossUSD: 1850000,
      taxWithholdingsUSD: 462500,
      benefitsContributionUSD: 185000,
      netDisbursementUSD: 1202500,
      status: 'DISBURSED',
    },
    {
      id: 'dept-102',
      departmentName: 'Global Sales & Enterprise Accounts',
      headcount: 98,
      monthlyGrossUSD: 1420000,
      taxWithholdingsUSD: 355000,
      benefitsContributionUSD: 142000,
      netDisbursementUSD: 923000,
      status: 'DISBURSED',
    },
  ];

  public getPayrollMetrics(): DepartmentPayrollDTO[] {
    return this.departments;
  }

  public getDepartmentById(id: string): DepartmentPayrollDTO | undefined {
    return this.departments.find(d => d.id === id);
  }

  public triggerDisbursement(id: string): DepartmentPayrollDTO | null {
    const dept = this.getDepartmentById(id);
    if (!dept) return null;
    dept.status = 'DISBURSED';
    return dept;
  }
}

const payrollService = new EnterprisePayrollService();
const payrollRouter = Router();

payrollRouter.get('/payroll/departments', (req: Request, res: Response) => {
  const items = payrollService.getPayrollMetrics();
  res.json({ success: true, data: items });
});

payrollRouter.post('/payroll/departments/:id/disburse', (req: Request, res: Response) => {
  const updated = payrollService.triggerDisbursement(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: 'Department not found' });
  res.json({ success: true, data: updated });
});

export default payrollRouter;
