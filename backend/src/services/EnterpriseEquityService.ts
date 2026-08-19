import { Router, Request, Response } from 'express';

export interface EquityGrantDTO {
  id: string;
  granteeName: string;
  roleTitle: string;
  grantType: string;
  sharesGranted: number;
  strikePriceUSD: number;
  currentFairMarketValueUSD: number;
  vestingProgressPercent: number;
  status: string;
}

export class EnterpriseEquityService {
  private grants: EquityGrantDTO[] = [
    {
      id: 'eq-1001',
      granteeName: 'Elena Rostova',
      roleTitle: 'VP of Engineering',
      grantType: 'ISO Stock Options',
      sharesGranted: 125000,
      strikePriceUSD: 1.25,
      currentFairMarketValueUSD: 18.50,
      vestingProgressPercent: 50.0,
      status: 'ACTIVE_VESTING',
    },
    {
      id: 'eq-1002',
      granteeName: 'Marcus Vance',
      roleTitle: 'Principal Architect',
      grantType: 'RSUs',
      sharesGranted: 85000,
      strikePriceUSD: 0.00,
      currentFairMarketValueUSD: 18.50,
      vestingProgressPercent: 50.0,
      status: 'ACTIVE_VESTING',
    },
  ];

  public getGrants(): EquityGrantDTO[] {
    return this.grants;
  }

  public exerciseOptionGrant(id: string, sharesToExercise: number): { success: boolean; totalCostUSD: number; remainingShares: number } | null {
    const grant = this.grants.find(g => g.id === id);
    if (!grant) return null;
    const totalCostUSD = sharesToExercise * grant.strikePriceUSD;
    return { success: true, totalCostUSD, remainingShares: grant.sharesGranted - sharesToExercise };
  }
}

const equityService = new EnterpriseEquityService();
const equityRouter = Router();

equityRouter.get('/equity/grants', (req: Request, res: Response) => {
  res.json({ success: true, data: equityService.getGrants() });
});

equityRouter.post('/equity/grants/:id/exercise', (req: Request, res: Response) => {
  const { sharesToExercise } = req.body;
  const result = equityService.exerciseOptionGrant(req.params.id, sharesToExercise);
  if (!result) return res.status(404).json({ success: false, error: 'Grant profile not found' });
  res.json({ success: true, data: result });
});

export default equityRouter;
