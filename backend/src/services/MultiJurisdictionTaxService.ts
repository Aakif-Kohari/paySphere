import { Router, Request, Response } from 'express';

export interface TaxJurisdictionDTO {
  id: string;
  countryName: string;
  regionName: string;
  corporateTaxRate: number;
  payrollTaxRate: number;
  filingStatus: string;
  totalTaxesRemittedUSD: number;
}

export class MultiJurisdictionTaxService {
  private jurisdictions: TaxJurisdictionDTO[] = [
    {
      id: 'juris-01',
      countryName: 'United States',
      regionName: 'Federal & State (50 States)',
      corporateTaxRate: 21.0,
      payrollTaxRate: 15.3,
      filingStatus: 'COMPLIANT',
      totalTaxesRemittedUSD: 2450000,
    },
    {
      id: 'juris-02',
      countryName: 'United Kingdom',
      regionName: 'HMRC Pay As You Earn (PAYE)',
      corporateTaxRate: 25.0,
      payrollTaxRate: 13.8,
      filingStatus: 'COMPLIANT',
      totalTaxesRemittedUSD: 890000,
    },
  ];

  public getJurisdictions(): TaxJurisdictionDTO[] {
    return this.jurisdictions;
  }

  public calculateTaxWithholding(grossSalaryUSD: number, countryCode: string): { corporateTax: number; payrollTax: number } {
    const juris = this.jurisdictions.find(j => j.id === countryCode || j.countryName.toLowerCase() === countryCode.toLowerCase());
    const rate = juris ? juris.payrollTaxRate : 15.0;
    const corpRate = juris ? juris.corporateTaxRate : 20.0;

    return {
      corporateTax: (grossSalaryUSD * corpRate) / 100,
      payrollTax: (grossSalaryUSD * rate) / 100,
    };
  }
}

const taxService = new MultiJurisdictionTaxService();
const taxRouter = Router();

taxRouter.get('/compliance/tax-jurisdictions', (req: Request, res: Response) => {
  res.json({ success: true, data: taxService.getJurisdictions() });
});

taxRouter.post('/compliance/calculate-tax', (req: Request, res: Response) => {
  const { grossSalaryUSD, countryCode } = req.body;
  const result = taxService.calculateTaxWithholding(grossSalaryUSD, countryCode);
  res.json({ success: true, data: result });
});

export default taxRouter;
