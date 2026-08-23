// @ts-nocheck
import { Router, Request, Response } from 'express';

export interface ContractorDTO {
  id: string;
  name: string;
  country: string;
  hourlyRateUSD: number;
  hoursBilledMonthly: number;
  monthlyGrossUSD: number;
  paymentMethod: string;
  payoutStatus: string;
}

export class ContractorDisbursementService {
  private contractors: ContractorDTO[] = [
    {
      id: 'cntr-501',
      name: 'Mateo Rossi',
      country: 'Italy',
      hourlyRateUSD: 145,
      hoursBilledMonthly: 160,
      monthlyGrossUSD: 23200,
      paymentMethod: 'SWIFT International Wire',
      payoutStatus: 'SCHEDULED',
    },
    {
      id: 'cntr-502',
      name: 'Aarav Sharma',
      country: 'India',
      hourlyRateUSD: 95,
      hoursBilledMonthly: 172,
      monthlyGrossUSD: 16340,
      paymentMethod: 'Wise Business ACH',
      payoutStatus: 'PAID',
    },
  ];

  public getContractors(): ContractorDTO[] {
    return this.contractors;
  }

  public triggerContractorPayout(id: string): ContractorDTO | null {
    const contractor = this.contractors.find((c) => c.id === id);
    if (!contractor) return null;
    contractor.payoutStatus = 'PAID';
    return contractor;
  }
}

const contractorService = new ContractorDisbursementService();
const contractorRouter = Router();

contractorRouter.get('/contractors/list', (req: Request, res: Response) => {
  res.json({ success: true, data: contractorService.getContractors() });
});

contractorRouter.post(
  '/contractors/:id/disburse',
  (req: Request, res: Response) => {
    const updated = contractorService.triggerContractorPayout(req.params.id);
    if (!updated)
      return res
        .status(404)
        .json({ success: false, error: 'Contractor profile not found' });
    res.json({ success: true, data: updated });
  },
);

export default contractorRouter;
