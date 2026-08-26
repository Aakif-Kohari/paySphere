// @ts-nocheck
import {
  EnterpriseDirectDepositService,
  BankAccount,
  DirectDepositTransaction,
  DirectDepositFilterOptions,
} from "../models/EnterpriseDirectDepositModel";

export class EnterpriseDirectDepositServiceHandler {
  public static fetchBankAccounts(filters?: Partial<DirectDepositFilterOptions>): BankAccount[] {
    return EnterpriseDirectDepositService.getAccounts(filters);
  }

  public static fetchAccountDetails(id: string): BankAccount | undefined {
    return EnterpriseDirectDepositService.getAccountById(id);
  }

  public static registerNewBankAccount(
    payload: Omit<BankAccount, "id" | "verificationStatus">
  ): BankAccount {
    return EnterpriseDirectDepositService.addBankAccount(payload);
  }

  public static fetchDirectDepositTransactions(): DirectDepositTransaction[] {
    return EnterpriseDirectDepositService.getTransactions();
  }

  public static processDirectDepositTransfer(
    accountId: string,
    amountTransferred: number,
    payPeriod: string
  ): DirectDepositTransaction {
    return EnterpriseDirectDepositService.triggerPayrollDirectDeposit(accountId, amountTransferred, payPeriod);
  }
}
