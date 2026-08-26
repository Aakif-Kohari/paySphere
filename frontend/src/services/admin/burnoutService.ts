import axios from 'axios';

const BASE_URL = '/api/v1/admin/burnout-predictor';

export const burnoutServiceAPI = {
    getDepartmentHeatmap: async () => {
        try {
            return await axios.get(`${BASE_URL}/heatmap`);
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    getHighRiskTopology: async (limit: number = 100) => {
        try {
            return await axios.get(`${BASE_URL}/topology`, { params: { limit } });
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    runAutoInterventions: async () => {
        try {
            return await axios.post(`${BASE_URL}/interventions/auto`);
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    getActiveInterventions: async () => {
        try {
            return await axios.get(`${BASE_URL}/interventions/active`);
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
