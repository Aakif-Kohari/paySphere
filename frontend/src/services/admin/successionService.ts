import axios from 'axios';

const API_URL = '/api/succession';

export interface KeyRole {
    _id: string;
    roleId: string;
    title: string;
    department: string;
    criticalityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    businessImpactScore: number;
    currentIncumbent: {
        employeeId: string;
        name: string;
        flightRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
        retirementWindow: string;
    };
    status: 'STABLE' | 'AT_RISK' | 'VACANT';
    skillsRequired: string[];
}

export interface SuccessionCandidate {
    _id: string;
    candidateId: string;
    targetRoleId: KeyRole;
    employeeName: string;
    currentRole: string;
    readinessTimeline: 'READY_NOW' | 'READY_IN_1_YEAR' | 'READY_IN_3_YEARS';
    nineBoxGrid: {
        potential: string;
        performance: string;
        gridPlacement: string;
    };
    skillsGap: string[];
    retentionRisk: string;
}

export interface SuccessionTopologyData {
    department: string;
    criticalRoles: number;
    atRisk: number;
    vacant: number;
    benchStrength: number;
    impact: number;
}

export const successionService = {
    getRoles: async (status?: string) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const response = await axios.get(`${API_URL}/roles?${params.toString()}`);
        return response.data.data;
    },

    getCandidates: async (page = 1, limit = 50, filters = {}) => {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
        if (filters.gridPlacement) params.append('gridPlacement', filters.gridPlacement);
        const response = await axios.get(`${API_URL}/candidates?${params.toString()}`);
        return response.data;
    },

    getTopology: async () => {
        const response = await axios.get(`${API_URL}/topology`);
        return response.data.data;
    },

    seedData: async () => {
        const response = await axios.post(`${API_URL}/seed`);
        return response.data;
    }
};
