/**
 * @fileoverview Forex Reconciliation Engine
 * @description Calculates realized and unrealized forex gains/losses 
 * based on RBI reference rates and actual bank realizations.
 * Issue: #960
 */

/**
 * Calculates the Realized Forex Gain/Loss when a payment is received.
 * Formula: (INR Actually Received) - (Original INR Equivalent at Invoice Date)
 * 
 * @param {number} inrReceived - The exact INR amount credited to the bank account
 * @param {number} originalInrEquivalent - The INR value calculated on the invoice date
 * @param {number} bankCharges - Any intermediary bank conversion fees deducted
 * @returns {{ netInr: number, realizedGainLoss: number }}
 */
function calculateRealizedGainLoss(inrReceived, originalInrEquivalent, bankCharges = 0) {
    const netInr = inrReceived - bankCharges;
    const realizedGainLoss = netInr - originalInrEquivalent;

    return {
        netInr: Math.round(netInr * 100) / 100,
        realizedGainLoss: Math.round(realizedGainLoss * 100) / 100
    };
}

/**
 * Calculates the Unrealized Forex Gain/Loss for open invoices at year-end (March 31).
 * Formula: (Foreign Amount * Year-End Closing Rate) - (Original INR Equivalent)
 * 
 * @param {number} foreignAmount - The outstanding foreign currency amount
 * @param {number} originalRate - The exchange rate on the invoice date
 * @param {number} closingRate - The RBI reference rate on March 31st
 * @returns {number} Unrealized gain/loss amount
 */
function calculateUnrealizedGainLoss(foreignAmount, originalRate, closingRate) {
    const originalInr = foreignAmount * originalRate;
    const closingInr = foreignAmount * closingRate;
    const unrealizedGainLoss = closingInr - originalInr;

    return Math.round(unrealizedGainLoss * 100) / 100;
}

/**
 * Fetches the latest cached exchange rate for a currency pair.
 * In a full implementation, this would query a Redis cache populated by a daily BullMQ cron job.
 * 
 * @param {string} fromCurrency - e.g., 'USD'
 * @param {string} toCurrency - e.g., 'INR'
 * @returns {Promise<number>} The exchange rate
 */
async function getExchangeRate(fromCurrency, toCurrency) {
    // Mocked rates for demonstration. 
    // Real implementation: return await redisClient.get(`forex:${fromCurrency}:${toCurrency}`);
    const mockRates = {
        'USD_INR': 83.50,
        'EUR_INR': 90.20,
        'GBP_INR': 105.40,
        'AED_INR': 22.75,
    };

    const key = `${fromCurrency}_${toCurrency}`;
    return mockRates[key] || 1;
}

module.exports = { calculateRealizedGainLoss, calculateUnrealizedGainLoss, getExchangeRate };
