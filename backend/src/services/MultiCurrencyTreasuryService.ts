// @ts-nocheck
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

  public async getDbVaults(tenantId: string): Promise<CurrencyVaultDTO[]> {
    const Treasury = require('../models/treasury.model');
    let record = await Treasury.findOne({ tenantId });
    if (!record) {
      record = await Treasury.create({
        tenantId,
        baseCurrency: 'USD',
        balances: { 'USD': 8450000.50, 'EUR': 3200000.00, 'GBP': 1950000.75 },
      });
    }

    const rates: { [key: string]: number } = { 'USD': 1.0, 'EUR': 1.085, 'GBP': 1.272 };
    const hedged: { [key: string]: number } = { 'USD': 100, 'EUR': 85, 'GBP': 90 };

    const list: CurrencyVaultDTO[] = [];
    for (const [code, val] of record.balances.entries()) {
      list.push({
        id: `vlt-${code.toLowerCase()}`,
        currencyCode: code,
        totalBalance: val,
        fxRateToUSD: rates[code] || 1.0,
        hedgedPercentage: hedged[code] || 80,
        status: 'ACTIVE',
      });
    }
    return list;
  }

  public async executeDbLiquiditySwap(tenantId: string, fromCurrency: string, toCurrency: string, amount: number): Promise<{ success: boolean; convertedUSD: number }> {
    const Treasury = require('../models/treasury.model');
    const record = await Treasury.findOne({ tenantId });
    if (!record) return { success: false, convertedUSD: 0 };

    const fromBalance = record.balances.get(fromCurrency) || 0;
    if (fromBalance < amount) return { success: false, convertedUSD: 0 };

    const rates: { [key: string]: number } = { 'USD': 1.0, 'EUR': 1.085, 'GBP': 1.272 };
    const fromRate = rates[fromCurrency.toUpperCase()] || 1.0;
    const toRate = rates[toCurrency.toUpperCase()] || 1.0;

    const convertedUSD = amount * fromRate;
    const addedAmount = convertedUSD / toRate;

    record.balances.set(fromCurrency, fromBalance - amount);
    record.balances.set(toCurrency, (record.balances.get(toCurrency) || 0) + addedAmount);

    await record.save();

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
