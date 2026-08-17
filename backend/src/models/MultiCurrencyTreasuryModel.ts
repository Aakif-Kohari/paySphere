export interface ForexRateLockModel {
  pair: string;
  spotRate: number;
  guaranteedUntil: string;
  providerDesk: string;
}

export class CurrencyVaultReserveModel {
  public vaultId: string;
  public ISO3Currency: string;
  public reserveBalance: number;
  public usdEquivalent: number;
  public rateLock: ForexRateLockModel;
  public isHedgingEnabled: boolean;
  public updatedAt: string;

  constructor(data: Partial<CurrencyVaultReserveModel>) {
    this.vaultId = data.vaultId || `vlt_${Math.random().toString(36).substr(2, 9)}`;
    this.ISO3Currency = data.ISO3Currency || 'USD';
    this.reserveBalance = data.reserveBalance || 0;
    this.rateLock = data.rateLock || {
      pair: `${this.ISO3Currency}/USD`,
      spotRate: 1.0,
      guaranteedUntil: new Date(Date.now() + 3600000).toISOString(),
      providerDesk: 'Global Treasury Desk',
    };
    this.usdEquivalent = this.reserveBalance * this.rateLock.spotRate;
    this.isHedgingEnabled = data.isHedgingEnabled ?? true;
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      vaultId: this.vaultId,
      ISO3Currency: this.ISO3Currency,
      reserveBalance: this.reserveBalance,
      usdEquivalent: this.usdEquivalent,
      rateLock: this.rateLock,
      isHedgingEnabled: this.isHedgingEnabled,
      updatedAt: this.updatedAt,
    };
  }
}
