import axios from 'axios';

const BASE_URL = '/api/v1/admin/global-mobility';

export const expatTaxAPI = {
    getMobilitySummary: async () => {
        try {
            return await axios.get(`${BASE_URL}/summary`);
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    getHighCostAssignments: async (limit: number = 100) => {
        try {
            return await axios.get(`${BASE_URL}/high-cost`, { params: { limit } });
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    seedDemoData: async () => {
        try {
            return await axios.post(`${BASE_URL}/seed`);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }
};
