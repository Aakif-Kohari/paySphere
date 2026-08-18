import { Router, Request, Response } from 'express';

export interface ReconciliationBatchDTO {
  id: string;
  batchName: string;
  bankPartner: string;
  totalDisbursedUSD: number;
  matchedTransactionsCount: number;
  unmatchedDiscrepanciesCount: number;
  varianceUSD: number;
  status: string;
}

export class EnterpriseReconciliationService {
  private batches: ReconciliationBatchDTO[] = [
    {
      id: 'rec-401',
      batchName: 'US-East ACH Payroll vs FedWire',
      bankPartner: 'JPMorgan Chase',
      totalDisbursedUSD: 4850000,
      matchedTransactionsCount: 1420,
      unmatchedDiscrepanciesCount: 0,
      varianceUSD: 0.00,
      status: 'PERFECT_MATCH',
    },
    {
      id: 'rec-402',
      batchName: 'UK & EU BACS / SEPA',
      bankPartner: 'Barclays Commercial',
      totalDisbursedUSD: 3120000,
      matchedTransactionsCount: 850,
      unmatchedDiscrepanciesCount: 2,
      varianceUSD: 14.50,
      status: 'VARIANCE_DETECTED',
    },
  ];

  public getBatches(): ReconciliationBatchDTO[] {
    return this.batches;
  }

  public resolveDiscrepancy(id: string): { success: boolean; updatedStatus: string } | null {
    const batch = this.batches.find(b => b.id === id);
    if (!batch) return null;
    batch.unmatchedDiscrepanciesCount = 0;
    batch.varianceUSD = 0.00;
    batch.status = 'PERFECT_MATCH';
    return { success: true, updatedStatus: batch.status };
  }
}

const reconcileService = new EnterpriseReconciliationService();
const reconcileRouter = Router();

reconcileRouter.get('/reconciliation/batches', (req: Request, res: Response) => {
  res.json({ success: true, data: reconcileService.getBatches() });
});

reconcileRouter.post('/reconciliation/batches/:id/resolve', (req: Request, res: Response) => {
  const result = reconcileService.resolveDiscrepancy(req.params.id);
  if (!result) return res.status(404).json({ success: false, error: 'Reconciliation batch not found' });
  res.json({ success: true, data: result });
});

export default reconcileRouter;
