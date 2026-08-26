import axios from 'axios';

const API_URL = '/api/tax-engine';

export interface TaxJurisdiction {
    _id: string;
    jurisdictionCode: string;
    country: string;
    region: string;
    taxRates: {
        corporateTax: number;
        payrollTaxEmployer: number;
        payrollTaxEmployee: number;
    };
    complianceStatus: 'HARMONIZED' | 'AT_RISK' | 'NON_COMPLIANT' | 'AUDIT_PENDING';
    metadata: {
        complexityScore: number;
        filingFrequency: string;
    };
}

export interface CorporateObligation {
    _id: string;
    obligationId: string;
    jurisdictionId: TaxJurisdiction;
    periodStart: string;
    periodEnd: string;
    financialMetrics: {
        grossRevenue: number;
        netTaxableIncome: number;
        payrollTotal: number;
    };
    taxLiabilities: {
        calculatedCorporateTax: number;
        calculatedPayrollTax: number;
        totalLiability: number;
        outstandingBalance: number;
    };
    status: 'DRAFT' | 'FILED' | 'PAID' | 'OVERDUE' | 'DISPUTED';
    riskFlags: Array<{ flagType: string; severity: string; description: string; detectedAt: string }>;
}

export interface RiskTopology {
    region: string;
    nodes: Array<{
        id: string;
        name: string;
        complexity: number;
        taxRate: number;
        liability: number;
        risk: number;
        status: string;
    }>;
    metrics: {
        aggregateLiability: number;
        aggregateRisk: number;
    };
}

export const taxService = {
    getJurisdictions: async (status?: string) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const response = await axios.get(`${API_URL}/jurisdictions?${params.toString()}`);
        return response.data.data;
    },

    getObligations: async (page = 1, limit = 50, filters = {}) => {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
        if (filters.status) params.append('status', filters.status);
        const response = await axios.get(`${API_URL}/obligations?${params.toString()}`);
        return response.data;
    },

    getRiskTopology: async () => {
        const response = await axios.get(`${API_URL}/topology`);
        return response.data.data;
    },

    seedData: async () => {
        const response = await axios.post(`${API_URL}/seed`);
        return response.data;
    }
};
