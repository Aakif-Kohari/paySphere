import axios from 'axios';

const BASE_URL = '/api/v1/admin/equity-vesting';

export const equityVestingAPI = {
    getEnterpriseSummary: async () => {
        try {
            return await axios.get(`${BASE_URL}/summary`);
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    getEmployeePortfolio: async (employeeId: string) => {
        try {
            return await axios.get(`${BASE_URL}/portfolio/${employeeId}`);
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    getTopHolders: async (limit: number = 100) => {
        try {
            return await axios.get(`${BASE_URL}/top-holders`, { params: { limit } });
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
