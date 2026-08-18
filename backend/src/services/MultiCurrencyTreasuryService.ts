import { Router, Request, Response } from 'express';

export interface CurrencyVaultDTO {
  id: string;
  currencyCode: string;
  totalBalance: number;
  fxRateToUSD: number;
  hedgedPercentage: number;
  status: string;
}

export class MultiCurrencyTreasuryService {
  private vaults: CurrencyVaultDTO[] = [
    {
      id: 'vlt-01',
      currencyCode: 'USD',
      totalBalance: 8450000.50,
      fxRateToUSD: 1.0,
      hedgedPercentage: 100,
      status: 'ACTIVE',
    },
    {
      id: 'vlt-02',
      currencyCode: 'EUR',
      totalBalance: 3200000.00,
      fxRateToUSD: 1.085,
      hedgedPercentage: 85,
      status: 'ACTIVE',
    },
    {
      id: 'vlt-03',
      currencyCode: 'GBP',
      totalBalance: 1950000.75,
      fxRateToUSD: 1.272,
      hedgedPercentage: 90,
      status: 'ACTIVE',
    },
  ];

  public getVaults(): CurrencyVaultDTO[] {
    return this.vaults;
  }

  public getVaultByCode(code: string): CurrencyVaultDTO | undefined {
    return this.vaults.find(v => v.currencyCode.toUpperCase() === code.toUpperCase());
  }

  public executeLiquiditySwap(fromCurrency: string, toCurrency: string, amount: number): { success: boolean; convertedUSD: number } {
    const vault = this.getVaultByCode(fromCurrency);
    if (!vault || vault.totalBalance < amount) {
      return { success: false, convertedUSD: 0 };
    }

    vault.totalBalance -= amount;
    const convertedUSD = amount * vault.fxRateToUSD;
    return { success: true, convertedUSD };
  }
}

const treasuryService = new MultiCurrencyTreasuryService();
const treasuryRouter = Router();

treasuryRouter.get('/treasury/vaults', (req: Request, res: Response) => {
  res.json({ success: true, data: treasuryService.getVaults() });
});

treasuryRouter.post('/treasury/swap', (req: Request, res: Response) => {
  const { fromCurrency, toCurrency, amount } = req.body;
  const result = treasuryService.executeLiquiditySwap(fromCurrency, toCurrency, amount);
  if (!result.success) {
    return res.status(400).json({ success: false, error: 'Insufficient vault liquidity' });
  }
  res.json({ success: true, data: result });
});

export default treasuryRouter;
