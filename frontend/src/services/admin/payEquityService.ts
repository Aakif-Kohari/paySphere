import axios from 'axios';

const BASE_URL = '/api/v1/admin/pay-equity';

export const payEquityAPI = {
    /**
     * Run the full compensation audit machine learning pipeline
     */
    runAudit: async () => {
        try {
            const response = await axios.post(`${BASE_URL}/audit`);
            return response;
        } catch (error) {
            console.error('Failed to run compensation audit:', error);
            throw error;
        }
    },

    /**
     * Retrieve statistical parity data for scatter plotting
     */
    getScatterData: async (department?: string) => {
        try {
            const response = await axios.get(`${BASE_URL}/scatter`, {
                params: { department }
            });
            return response;
        } catch (error) {
            console.error('Failed to get scatter data:', error);
            throw error;
        }
    },

    /**
     * Calculate budget to remediate disparities in a specific audit
     */
    calculateRemediation: async (auditId: string) => {
        try {
            const response = await axios.post(`${BASE_URL}/audit/${auditId}/remediation`);
            return response;
        } catch (error) {
            console.error('Failed to calculate remediation budget:', error);
            throw error;
        }
    },

    /**
     * Fetches the top 10 recent historical audits
     */
    getAuditHistory: async () => {
        try {
            const response = await axios.get(`${BASE_URL}/history`);
            return response;
        } catch (error) {
            console.error('Failed to get audit history:', error);
            throw error;
        }
    },

    /**
     * Seeds compensation data into DB for demonstration
     */
    seedData: async () => {
        try {
            const response = await axios.post(`${BASE_URL}/seed`);
            return response;
        } catch (error) {
            console.error('Failed to seed equity data:', error);
            throw error;
        }
    }
};
