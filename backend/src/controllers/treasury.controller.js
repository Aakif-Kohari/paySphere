const { MultiCurrencyTreasuryService } = require('../services/MultiCurrencyTreasuryService');
const TreasuryRebalanceLog = require('../models/treasuryRebalanceLog.model');

const treasuryService = new MultiCurrencyTreasuryService();

exports.getVaults = async (req, res, next) => {
  try {
    const vaults = await treasuryService.getDbVaults(req.tenantId);
    res.status(200).json({ success: true, data: vaults });
  } catch (error) {
    next(error);
  }
};

exports.executeSwap = async (req, res, next) => {
  try {
    const { fromCurrency, toCurrency, amount } = req.body;
    if (!fromCurrency || !toCurrency || !amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid swap parameters' });
    }

    const result = await treasuryService.executeDbLiquiditySwap(
      req.tenantId,
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase(),
      Number(amount)
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: 'Insufficient vault liquidity or vault not found' });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getRebalanceLogs = async (req, res, next) => {
  try {
    const logs = await TreasuryRebalanceLog.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
