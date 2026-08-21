import treasuryService from '../services/treasuryService.js';
import { AsyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const getTreasuryWallets = AsyncHandler(async (req, res) => {
  await treasuryService.ensureMockDataExists(); // Seeding if empty
  const wallets = await treasuryService.getWallets();

  return res.status(200).json(
    new ApiResponse(200, wallets, 'Wallets retrieved successfully')
  );
});

export const getLiveExchangeRates = AsyncHandler(async (req, res) => {
  const rates = treasuryService.getMockExchangeRates();
  return res.status(200).json(
    new ApiResponse(200, rates, 'Real-time exchange rates retrieved')
  );
});

export const getForwardLiquidityForecast = AsyncHandler(async (req, res) => {
  await treasuryService.ensureMockDataExists();
  const forecast = await treasuryService.generateLiquidityForecast();
  return res.status(200).json(
    new ApiResponse(200, forecast, 'Liquidity forecast calculated successfully')
  );
});

export const getChartSequence = AsyncHandler(async (req, res) => {
  const chartSequence = await treasuryService.generateChartTimeSequence();
  return res.status(200).json(
    new ApiResponse(200, chartSequence, 'Time series data generated')
  );
});

export const getTradeLedger = AsyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 15;
  await treasuryService.ensureMockDataExists();

  const ledgerData = await treasuryService.getTradeLedger(page, limit);
  return res.status(200).json(
    new ApiResponse(200, ledgerData, 'Trade ledger retrieved')
  );
});

export const executeForexTrade = AsyncHandler(async (req, res) => {
  const { sourceCurrency, targetCurrency, amountSold } = req.body;
  if (!sourceCurrency || !targetCurrency || !amountSold || amountSold <= 0) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid trade parameters'));
  }

  const userId = req.user ? req.user._id : null;
  const trade = await treasuryService.executeTrade({ sourceCurrency, targetCurrency, amountSold }, userId);

  return res.status(200).json(
    new ApiResponse(200, trade, 'Forex trade executed and settled')
  );
});
