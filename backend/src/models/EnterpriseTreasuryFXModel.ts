export interface SettlementLegDTO {
  legId: string;
  currency: string;
  amount: number;
  isSettled: boolean;
}

export class EnterpriseTreasuryFXModel {
  public swapId: string;
  public baseCurrency: string;
  public quoteCurrency: string;
  public spotRate: number;
  public forwardPoints: number;
  public notionalUSD: number;
  public primeBrokerDesk: string;
  public legA: SettlementLegDTO;
  public legB: SettlementLegDTO;
  public isISDACovered: boolean;
  public createdAt: string;

  constructor(data: Partial<EnterpriseTreasuryFXModel>) {
    this.swapId = data.swapId || `swap_${Math.random().toString(36).substr(2, 9)}`;
    this.baseCurrency = data.baseCurrency || 'USD';
    this.quoteCurrency = data.quoteCurrency || 'EUR';
    this.spotRate = data.spotRate || 0.9215;
    this.forwardPoints = data.forwardPoints || 0.0010;
    this.notionalUSD = data.notionalUSD || 1000000;
    this.primeBrokerDesk = data.primeBrokerDesk || 'Global Institutional FX';
    this.legA = data.legA || { legId: 'leg_a', currency: 'USD', amount: 1000000, isSettled: true };
    this.legB = data.legB || { legId: 'leg_b', currency: 'EUR', amount: 921500, isSettled: true };
    this.isISDACovered = data.isISDACovered ?? true;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      swapId: this.swapId,
      baseCurrency: this.baseCurrency,
      quoteCurrency: this.quoteCurrency,
      spotRate: this.spotRate,
      forwardPoints: this.forwardPoints,
      notionalUSD: this.notionalUSD,
      primeBrokerDesk: this.primeBrokerDesk,
      legA: this.legA,
      legB: this.legB,
      isISDACovered: this.isISDACovered,
      createdAt: this.createdAt,
    };
  }
}
