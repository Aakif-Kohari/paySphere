import axios from 'axios';

const API_URL = '/api/immigration';

export interface ExpatWorker {
    _id: string;
    workerId: string;
    fullName: string;
    homeCountry: string;
    hostCountry: string;
    department: string;
    jobTitle: string;
    overallComplianceStatus: 'CLEARED' | 'WARNING' | 'CRITICAL' | 'VIOLATION';
}

export interface VisaSponsorship {
    _id: string;
    sponsorshipId: string;
    workerId: ExpatWorker;
    visaType: string;
    sponsoringEntity: string;
    issueDate: string;
    expirationDate: string;
    renewalFilingDeadline: string;
    visaStatus: 'ACTIVE' | 'PROCESSING_RENEWAL' | 'EXPIRED' | 'REVOKED' | 'DENIED';
    legalFees: { billed: number; paid: number };
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
}

export interface ImmigrationRiskData {
    country: string;
    totalWorkers: number;
    activeVisas: number;
    expiringVisas: number;
    riskIndex: number;
    spend: number;
}

export const immigrationService = {
    getWorkers: async (status?: string) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const response = await axios.get(`${API_URL}/workers?${params.toString()}`);
        return response.data.data;
    },

    getSponsorships: async (page = 1, limit = 50, filters = {}) => {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
        if (filters.status) params.append('status', filters.status);
        const response = await axios.get(`${API_URL}/sponsorships?${params.toString()}`);
        return response.data;
    },

    getRiskChart: async () => {
        const response = await axios.get(`${API_URL}/risk-chart`);
        return response.data.data;
    },

    seedData: async () => {
        const response = await axios.post(`${API_URL}/seed`);
        return response.data;
    }
};
