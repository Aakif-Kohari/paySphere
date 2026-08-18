export interface ContractorProfile {
  id: string;
  contractorName: string;
  taxIdOrEin: string;
  country: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'INR' | 'AUD';
  taxFormType: 'W-9' | 'W-8BEN' | 'W-8BEN-E';
  taxFormStatus: 'verified' | 'pending-review' | 'expired';
  hourlyRateOrRetainer: number;
  paymentMethod: 'SWIFT' | 'SEPA' | 'ACH' | 'Wise';
  contractTitle: string;
  status: 'active' | 'onboarding' | 'terminated';
  onboardedDate: string;
}

export interface ContractorPayout {
  id: string;
  contractorId: string;
  contractorName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  payoutDate: string;
  taxWithheld: number;
  netPayoutAmount: number;
  status: 'completed' | 'processing' | 'held-for-tax-form';
}

export interface ContractorFilterOptions {
  country: string;
  taxFormType: string;
  taxFormStatus: string;
  searchQuery: string;
}

const INITIAL_CONTRACTORS: ContractorProfile[] = [
  {
    id: "contractor-101",
    contractorName: "Liam O'Connor",
    taxIdOrEin: "W8BEN-IE-90124",
    country: "Ireland",
    currency: "EUR",
    taxFormType: "W-8BEN",
    taxFormStatus: "verified",
    hourlyRateOrRetainer: 85,
    paymentMethod: "SEPA",
    contractTitle: "Senior Frontend React Architect",
    status: "active",
    onboardedDate: "Jan 10, 2026",
  },
  {
    id: "contractor-102",
    contractorName: "Apex Cloud Innovations LLC",
    taxIdOrEin: "98-4412091",
    country: "United States",
    currency: "USD",
    taxFormType: "W-9",
    taxFormStatus: "verified",
    hourlyRateOrRetainer: 125,
    paymentMethod: "ACH",
    contractTitle: "DevOps & Kubernetes Infrastructure Consulting",
    status: "active",
    onboardedDate: "Feb 01, 2026",
  },
  {
    id: "contractor-103",
    contractorName: "Aarav Sharma",
    taxIdOrEin: "PAN-ABCDE1234F",
    country: "India",
    currency: "INR",
    taxFormType: "W-8BEN",
    taxFormStatus: "pending-review",
    hourlyRateOrRetainer: 45,
    paymentMethod: "Wise",
    contractTitle: "Full-Stack Node.js Engineer",
    status: "onboarding",
    onboardedDate: "Aug 12, 2026",
  },
];

const INITIAL_PAYOUTS: ContractorPayout[] = [
  {
    id: "payout-201",
    contractorId: "contractor-101",
    contractorName: "Liam O'Connor",
    invoiceNumber: "INV-2026-081",
    amount: 6800,
    currency: "EUR",
    payoutDate: "Aug 15, 2026",
    taxWithheld: 0,
    netPayoutAmount: 6800,
    status: "completed",
  },
];

export class EnterpriseContractorService {
  private static contractors: ContractorProfile[] = [...INITIAL_CONTRACTORS];
  private static payouts: ContractorPayout[] = [...INITIAL_PAYOUTS];

  public static getContractors(options?: Partial<ContractorFilterOptions>): ContractorProfile[] {
    let result = [...this.contractors];
    if (!options) return result;

    if (options.country && options.country !== "All") {
      result = result.filter((c) => c.country === options.country);
    }

    if (options.taxFormType && options.taxFormType !== "All") {
      result = result.filter((c) => c.taxFormType === options.taxFormType);
    }

    if (options.taxFormStatus && options.taxFormStatus !== "All") {
      result = result.filter((c) => c.taxFormStatus === options.taxFormStatus);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.contractorName.toLowerCase().includes(q) ||
          c.contractTitle.toLowerCase().includes(q) ||
          c.taxIdOrEin.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public static getContractorById(id: string): ContractorProfile | undefined {
    return this.contractors.find((c) => c.id === id);
  }

  public static onboardContractor(
    profile: Omit<ContractorProfile, "id" | "status" | "onboardedDate">
  ): ContractorProfile {
    const newProfile: ContractorProfile = {
      ...profile,
      id: `contractor-${Date.now()}`,
      status: "active",
      onboardedDate: "Just now",
    };
    this.contractors.unshift(newProfile);
    return newProfile;
  }

  public static getPayoutHistory(): ContractorPayout[] {
    return [...this.payouts];
  }

  public static processInvoicePayout(
    contractorId: string,
    invoiceNumber: string,
    amount: number
  ): ContractorPayout {
    const contractor = this.getContractorById(contractorId);
    if (!contractor) throw new Error("Contractor profile not found.");

    const taxWithheld = contractor.taxFormStatus !== 'verified' ? Math.round(amount * 0.3) : 0;
    const netPayoutAmount = amount - taxWithheld;

    const newPayout: ContractorPayout = {
      id: `payout-${Date.now()}`,
      contractorId,
      contractorName: contractor.contractorName,
      invoiceNumber,
      amount,
      currency: contractor.currency,
      payoutDate: "Just now",
      taxWithheld,
      netPayoutAmount,
      status: contractor.taxFormStatus !== 'verified' ? 'held-for-tax-form' : 'completed',
    };

    this.payouts.unshift(newPayout);
    return newPayout;
  }
}
