import express from 'express';
import {
    getTreasuryWallets,
    getLiveExchangeRates,
    getForwardLiquidityForecast,
    getChartSequence,
    getTradeLedger,
    executeForexTrade
} from '../controllers/treasury.controller.js';

const router = express.Router();

router.get('/wallets', getTreasuryWallets);
router.get('/rates', getLiveExchangeRates);
router.get('/forecast', getForwardLiquidityForecast);
router.get('/forecast/chart', getChartSequence);
router.get('/trades', getTradeLedger);
router.post('/trades/execute', executeForexTrade);

export default router;
