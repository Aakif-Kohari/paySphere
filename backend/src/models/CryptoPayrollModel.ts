export interface OnChainTxReceiptModel {
  txHash: string;
  chainNetwork: string;
  tokenSymbol: string;
  amountToken: number;
  recipientAddress: string;
  blockHeight: number;
  confirmedAt: string;
}

export class CryptoVaultWalletModel {
  public walletId: string;
  public chainNetwork: string;
  public tokenSymbol: string;
  public publicAddress: string;
  public tokenBalance: number;
  public usdValuation: number;
  public isMultiSigSecured: boolean;
  public recentReceipts: OnChainTxReceiptModel[];
  public createdAt: string;

  constructor(data: Partial<CryptoVaultWalletModel>) {
    this.walletId = data.walletId || `wlt_${Math.random().toString(36).substr(2, 9)}`;
    this.chainNetwork = data.chainNetwork || 'Solana Network';
    this.tokenSymbol = data.tokenSymbol || 'USDC-SPL';
    this.publicAddress = data.publicAddress || '8xZ9...44mA';
    this.tokenBalance = data.tokenBalance || 0;
    this.usdValuation = data.usdValuation || this.tokenBalance;
    this.isMultiSigSecured = data.isMultiSigSecured ?? true;
    this.recentReceipts = data.recentReceipts || [];
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      walletId: this.walletId,
      chainNetwork: this.chainNetwork,
      tokenSymbol: this.tokenSymbol,
      publicAddress: this.publicAddress,
      tokenBalance: this.tokenBalance,
      usdValuation: this.usdValuation,
      isMultiSigSecured: this.isMultiSigSecured,
      recentReceipts: this.recentReceipts,
      createdAt: this.createdAt,
    };
  }
}
