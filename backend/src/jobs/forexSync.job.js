const https = require('https');
const ExchangeRate = require('../models/exchangeRate.model');
const logger = require('../utils/logger');

/**
 * Fetches exchange rates from a public API (Frankfurter API) with USD as base.
 * Falls back to mock rates if request fails or times out.
 * @returns {Promise<Object>} Object containing baseCurrency, rates, and date
 */
function fetchRatesFromApi() {
  return new Promise((resolve) => {
    const url = 'https://api.frankfurter.app/latest?from=USD';
    const request = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            resolve({
              baseCurrency: parsed.amount ? 'USD' : parsed.base || 'USD',
              rates: parsed.rates,
              date: new Date(parsed.date || Date.now()),
            });
            return;
          }
          throw new Error(`API returned status code ${res.statusCode}`);
        } catch (error) {
          logger.warn('Failed to parse exchange rates API response. Using fallback rates.', { error: error.message });
          resolve(getFallbackRates());
        }
      });
    });

    request.on('error', (error) => {
      logger.warn('Forex API network request failed. Using fallback rates.', { error: error.message });
      resolve(getFallbackRates());
    });

    request.setTimeout(5000, () => {
      request.destroy();
      logger.warn('Forex API network request timed out. Using fallback rates.');
      resolve(getFallbackRates());
    });
  });
}

function getFallbackRates() {
  return {
    baseCurrency: 'USD',
    rates: {
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.50,
      CAD: 1.36,
      AUD: 1.51,
      JPY: 155.80,
      SGD: 1.35,
    },
    date: new Date(),
  };
}

/**
 * Daily cron job runner that fetches exchange rates and updates the DB.
 */
async function runForexSyncJob() {
  logger.info('Starting daily exchange rate sync job...');
  try {
    const { baseCurrency, rates, date } = await fetchRatesFromApi();
    
    // Normalize date to midnight UTC
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const exchangeRate = await ExchangeRate.findOneAndUpdate(
      { date: normalizedDate },
      { baseCurrency, rates },
      { upsert: true, new: true }
    );

    logger.info('Daily exchange rates synchronized successfully.', { date: normalizedDate });
    return exchangeRate;
  } catch (error) {
    logger.error('Failed to run forex sync job:', { error: error.message });
    throw error;
  }
}

module.exports = { runForexSyncJob, fetchRatesFromApi, getFallbackRates };
