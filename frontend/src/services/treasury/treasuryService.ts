import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class TreasuryService {
    async getWallets() {
        try {
            const resp = await axios.get(`${API_URL}/api/treasury-hub/wallets`, { withCredentials: true });
            return resp.data;
        } catch (error) {
            console.error('Error fetching generic treasury wallets:', error);
            throw error;
        }
    }

    async getLiveRates() {
        try {
            const resp = await axios.get(`${API_URL}/api/treasury-hub/rates`, { withCredentials: true });
            return resp.data;
        } catch (error) {
            console.error('Error fetching rates:', error);
            throw error;
        }
    }

    async getLiquidityForecast() {
        try {
            const resp = await axios.get(`${API_URL}/api/treasury-hub/forecast`, { withCredentials: true });
            return resp.data;
        } catch (error) {
            console.error('Error fetching liquidity forecasts:', error);
            throw error;
        }
    }

    async getLiquidityChartData() {
        try {
            const resp = await axios.get(`${API_URL}/api/treasury-hub/forecast/chart`, { withCredentials: true });
            return resp.data;
        } catch (error) {
            console.error('Error fetching chart data:', error);
            throw error;
        }
    }

    async getTradeLedger(page = 1) {
        try {
            const resp = await axios.get(`${API_URL}/api/treasury-hub/trades?page=${page}`, { withCredentials: true });
            return resp.data;
        } catch (error) {
            console.error('Error fetching trade ledger:', error);
            throw error;
        }
    }

    async splitExecuteForex(payload: { sourceCurrency: string; targetCurrency: string; amountSold: number; }) {
        try {
            const resp = await axios.post(`${API_URL}/api/treasury-hub/trades/execute`, payload, { withCredentials: true });
            return resp.data;
        } catch (error) {
            console.error('Error executing forex swap:', error);
            throw error;
        }
    }
}

export default new TreasuryService();
