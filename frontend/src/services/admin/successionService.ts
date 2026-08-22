import axios from 'axios';

// Assuming base URL configuration is handled in a central axios instance. 
// For this standalone service we define the base route.
const BASE_URL = '/api/v1/admin/succession';

export const successionAPI = {
    /**
     * Evaluates the 9-box grid position based on performance and potential
     */
    getTalentMatrix: async (department?: string) => {
        try {
            const response = await axios.get(`${BASE_URL}/matrix`, {
                params: { department }
            });
            return response;
        } catch (error) {
            console.error('Failed to fetch talent matrix:', error);
            throw error;
        }
    },

    /**
     * Retrieves high flight risk critical talent (Top Flight Risk Topology)
     */
    getFlightRiskTopology: async (threshold: number = 70) => {
        try {
            const response = await axios.get(`${BASE_URL}/topology/flight-risk`, {
                params: { threshold }
            });
            return response;
        } catch (error) {
            console.error('Failed to fetch flight risk topology:', error);
            throw error;
        }
    },

    /**
     * Dashboard Summary API Logic
     */
    getDashboardSummary: async () => {
        try {
            const response = await axios.get(`${BASE_URL}/dashboard/summary`);
            return response;
        } catch (error) {
            console.error('Failed to fetch dashboard summary:', error);
            throw error;
        }
    },

    /**
     * Proposes candidates for a succession plan using readiness and performance logic
     */
    suggestCandidates: async (targetRoleId: string) => {
        try {
            const response = await axios.get(`${BASE_URL}/plans/${targetRoleId}/suggest-candidates`);
            return response;
        } catch (error) {
            console.error('Failed to suggest candidates:', error);
            throw error;
        }
    },

    /**
     * Create or update a succession plan
     */
    upsertSuccessionPlan: async (planPayload: any) => {
        try {
            const response = await axios.post(`${BASE_URL}/plans`, planPayload);
            return response;
        } catch (error) {
            console.error('Failed to upsert succession plan:', error);
            throw error;
        }
    },

    /**
     * Batch simulate data for a demo environment
     */
    seedDemoData: async () => {
        try {
            const response = await axios.post(`${BASE_URL}/seed-demo`);
            return response;
        } catch (error) {
            console.error('Failed to seed demo data:', error);
            throw error;
        }
    }
};
