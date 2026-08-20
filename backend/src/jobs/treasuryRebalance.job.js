const Treasury = require('../models/treasury.model');
const Settlement = require('../models/settlement.model');
const TreasuryRebalanceLog = require('../models/treasuryRebalanceLog.model');
const logger = require('../utils/logger');

/**
 * Treasury Vault Liquidity Auto-Rebalancing Job.
 * Runs daily to scan vault balances against minimum reserves and upcoming liabilities,
 * triggering automatic rebalancing swaps from surplus vaults.
 */
async function runTreasuryRebalancingJob() {
  logger.info('Starting daily treasury rebalancing job...');

  const treasuries = await Treasury.find({});
  if (treasuries.length === 0) {
    logger.info('No treasury vaults found to rebalance.');
    return { success: true, processedTenantsCount: 0 };
  }

  const { MultiCurrencyTreasuryService } = require('../services/MultiCurrencyTreasuryService');
  const treasuryService = new MultiCurrencyTreasuryService();
  const rates = { 'USD': 1.0, 'EUR': 1.085, 'GBP': 1.272 };

  let loggedSwapsCount = 0;

  for (const record of treasuries) {
    const tenantId = record.tenantId;

    // 1. Calculate upcoming F&F liabilities for the current tenant
    const pendingSettlements = await Settlement.find({
      tenantId,
      status: { $in: ['draft', 'pending_approval', 'approved'] }
    }).populate('employeeId', 'targetCurrency');

    const pendingLiabilities = {};
    for (const s of pendingSettlements) {
      const currency = (s.employeeId && s.employeeId.targetCurrency) || 'USD';
      pendingLiabilities[currency] = (pendingLiabilities[currency] || 0) + s.netSettlement;
    }

    // 2. Identify deficits and surpluses
    const deficits = [];
    const surpluses = [];

    const minReservesMap = record.minReserves || new Map([['USD', 100000], ['EUR', 50000], ['GBP', 30000]]);
    
    // Scan all currencies
    const allCurrencies = ['USD', 'EUR', 'GBP'];
    for (const currency of allCurrencies) {
      const balance = record.balances.get(currency) || 0;
      const minReserve = minReservesMap.get(currency) || 0;
      const liability = pendingLiabilities[currency] || 0;
      const required = minReserve + liability;

      const diff = balance - required;
      if (diff < 0) {
        deficits.push({ currency, amount: Math.abs(diff) });
      } else if (diff > 0) {
        surpluses.push({ currency, amount: diff });
      }
    }

    // 3. Rebalance: swap surplus to cover deficits
    for (const deficit of deficits) {
      // Find the best surplus vault to draw from (highest surplus in USD equivalent)
      let bestSurplus = null;
      let maxSurplusUSD = 0;

      for (const surplus of surpluses) {
        const rate = rates[surplus.currency] || 1.0;
        const surplusUSD = surplus.amount * rate;
        if (surplusUSD > maxSurplusUSD) {
          maxSurplusUSD = surplusUSD;
          bestSurplus = surplus;
        }
      }

      if (!bestSurplus) {
        // Log failure - no surplus available
        await TreasuryRebalanceLog.create({
          tenantId,
          fromCurrency: 'N/A',
          toCurrency: deficit.currency,
          amountSwapped: 0,
          fxRate: 0,
          status: 'Failed',
          details: `Deficit of ${deficit.amount} ${deficit.currency} could not be resolved. No surplus vaults found.`,
        });
        logger.warn(`[Treasury Rebalance] Deficit for tenant ${tenantId} in ${deficit.currency} unresolved.`);
        continue;
      }

      // Calculate conversion
      const fromRate = rates[bestSurplus.currency] || 1.0;
      const toRate = rates[deficit.currency] || 1.0;

      // Swap enough surplus currency to cover the deficit
      const neededInUSD = deficit.amount * toRate;
      const amountToSwapFromSurplus = neededInUSD / fromRate;

      if (bestSurplus.amount < amountToSwapFromSurplus) {
        // Can only do a partial swap
        const partialSwapAmount = bestSurplus.amount;
        const partialSwapUSD = partialSwapAmount * fromRate;
        const partialReceivedAmount = partialSwapUSD / toRate;

        try {
          const swapResult = await treasuryService.executeDbLiquiditySwap(
            tenantId,
            bestSurplus.currency,
            deficit.currency,
            partialSwapAmount
          );

          if (swapResult.success) {
            await TreasuryRebalanceLog.create({
              tenantId,
              fromCurrency: bestSurplus.currency,
              toCurrency: deficit.currency,
              amountSwapped: partialSwapAmount,
              fxRate: fromRate / toRate,
              status: 'Success',
              details: `Partial rebalancing executed. Covered ${partialReceivedAmount} of ${deficit.amount} deficit.`,
            });
            loggedSwapsCount++;
            bestSurplus.amount = 0; // Exhausted
          }
        } catch (err) {
          logger.error('Failed partial rebalance swap execution', { error: err.message });
        }
      } else {
        // Full swap to cover the deficit
        try {
          const swapResult = await treasuryService.executeDbLiquiditySwap(
            tenantId,
            bestSurplus.currency,
            deficit.currency,
            amountToSwapFromSurplus
          );

          if (swapResult.success) {
            await TreasuryRebalanceLog.create({
              tenantId,
              fromCurrency: bestSurplus.currency,
              toCurrency: deficit.currency,
              amountSwapped: amountToSwapFromSurplus,
              fxRate: fromRate / toRate,
              status: 'Success',
              details: `Auto-rebalanced to cover ${deficit.amount} deficit.`,
            });
            loggedSwapsCount++;
            bestSurplus.amount -= amountToSwapFromSurplus; // Deduct from surplus tracker
          }
        } catch (err) {
          logger.error('Failed rebalance swap execution', { error: err.message });
        }
      }
    }
  }

  logger.info(`Treasury rebalancing job complete. Swapped ${loggedSwapsCount} times.`);
  return { success: true, processedTenantsCount: treasuries.length, swapsExecuted: loggedSwapsCount };
}

module.exports = {
  runTreasuryRebalancingJob
};
