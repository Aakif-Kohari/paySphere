import {
  EnterpriseContractorService,
  ContractorProfile,
  ContractorPayout,
  ContractorFilterOptions,
} from "../models/EnterpriseContractorModel";

export class EnterpriseContractorServiceHandler {
  public static fetchContractors(filters?: Partial<ContractorFilterOptions>): ContractorProfile[] {
    return EnterpriseContractorService.getContractors(filters);
  }

  public static fetchContractorDetails(id: string): ContractorProfile | undefined {
    return EnterpriseContractorService.getContractorById(id);
  }

  public static onboardNewContractor(
    payload: Omit<ContractorProfile, "id" | "status" | "onboardedDate">
  ): ContractorProfile {
    return EnterpriseContractorService.onboardContractor(payload);
  }

  public static fetchContractorPayouts(): ContractorPayout[] {
    return EnterpriseContractorService.getPayoutHistory();
  }

  public static executeContractorPayout(
    contractorId: string,
    invoiceNumber: string,
    amount: number
  ): ContractorPayout {
    return EnterpriseContractorService.processInvoicePayout(contractorId, invoiceNumber, amount);
  }
}
