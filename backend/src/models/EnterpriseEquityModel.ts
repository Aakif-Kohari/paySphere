export interface VestingTrancheDTO {
  trancheId: string;
  vestDate: string;
  shareQuantity: number;
  isVested: boolean;
}

export class EnterpriseEquityModel {
  public grantId: string;
  public granteeId: string;
  public granteeName: string;
  public grantType: 'ISO' | 'NSO' | 'RSU';
  public totalSharesGranted: number;
  public strikePriceUSD: number;
  public fairMarketValueUSD: number;
  public cliffDurationMonths: number;
  public totalVestingMonths: number;
  public tranches: VestingTrancheDTO[];
  public isApprovedByBoard: boolean;
  public createdAt: string;

  constructor(data: Partial<EnterpriseEquityModel>) {
    this.grantId = data.grantId || `eq_${Math.random().toString(36).substr(2, 9)}`;
    this.granteeId = data.granteeId || 'usr_emp_101';
    this.granteeName = data.granteeName || 'Key Employee';
    this.grantType = data.grantType || 'ISO';
    this.totalSharesGranted = data.totalSharesGranted || 50000;
    this.strikePriceUSD = data.strikePriceUSD || 1.50;
    this.fairMarketValueUSD = data.fairMarketValueUSD || 18.50;
    this.cliffDurationMonths = data.cliffDurationMonths || 12;
    this.totalVestingMonths = data.totalVestingMonths || 48;
    this.tranches = data.tranches || [];
    this.isApprovedByBoard = data.isApprovedByBoard ?? true;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      grantId: this.grantId,
      granteeId: this.granteeId,
      granteeName: this.granteeName,
      grantType: this.grantType,
      totalSharesGranted: this.totalSharesGranted,
      strikePriceUSD: this.strikePriceUSD,
      fairMarketValueUSD: this.fairMarketValueUSD,
      cliffDurationMonths: this.cliffDurationMonths,
      totalVestingMonths: this.totalVestingMonths,
      tranches: this.tranches,
      isApprovedByBoard: this.isApprovedByBoard,
      createdAt: this.createdAt,
    };
  }
}
