export interface StatementLineItemDTO {
  lineItemId: string;
  transactionReference: string;
  amountUSD: number;
  isMatched: boolean;
}

export class EnterpriseReconciliationModel {
  public batchId: string;
  public batchName: string;
  public bankPartner: string;
  public clearingSystem: string;
  public totalDisbursedUSD: number;
  public matchedCount: number;
  public discrepancyCount: number;
  public varianceUSD: number;
  public statementItems: StatementLineItemDTO[];
  public isGLPosted: boolean;
  public createdAt: string;

  constructor(data: Partial<EnterpriseReconciliationModel>) {
    this.batchId = data.batchId || `rec_${Math.random().toString(36).substr(2, 9)}`;
    this.batchName = data.batchName || 'Payroll Clearing Batch';
    this.bankPartner = data.bankPartner || 'Global Settlement Bank';
    this.clearingSystem = data.clearingSystem || 'FedACH';
    this.totalDisbursedUSD = data.totalDisbursedUSD || 1000000;
    this.matchedCount = data.matchedCount || 500;
    this.discrepancyCount = data.discrepancyCount || 0;
    this.varianceUSD = data.varianceUSD || 0.00;
    this.statementItems = data.statementItems || [];
    this.isGLPosted = data.isGLPosted ?? true;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      batchId: this.batchId,
      batchName: this.batchName,
      bankPartner: this.bankPartner,
      clearingSystem: this.clearingSystem,
      totalDisbursedUSD: this.totalDisbursedUSD,
      matchedCount: this.matchedCount,
      discrepancyCount: this.discrepancyCount,
      varianceUSD: this.varianceUSD,
      statementItems: this.statementItems,
      isGLPosted: this.isGLPosted,
      createdAt: this.createdAt,
    };
  }
}
