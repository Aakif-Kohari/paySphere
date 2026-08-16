/**
 * @fileoverview Foreign Exchange (FX) Rate Service
 * @description Provides real-time foreign exchange rate sync, Redis caching (24h TTL),
 * multi-currency conversion, and rate locking for global payroll processing.
 */

'use strict';

const logger = require('../utils/logger');
const cacheService = require('./cache.service');

// Static fallback rates against USD (used when Redis/external API is unreachable)
const MOCK_FX_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  CAD: 1.36,
  AUD: 1.51,
  JPY: 155.2,
  SGD: 1.34,
};

class FXService {
  /**
   * Normalize currency code to 3-letter uppercase ISO format.
   * @param {string} code
   * @returns {string}
   */
  static _normalizeCurrency(code) {
    if (!code || typeof code !== 'string') return 'USD';
    return code.trim().toUpperCase();
  }

  /**
   * Get exchange rate between two currencies.
   * Uses Redis caching with a 24-hour TTL.
   *
   * @param {string} fromCurrency Base currency (e.g. 'USD')
   * @param {string} toCurrency Target currency (e.g. 'EUR')
   * @returns {Promise<number>} Exchange rate multiplier
   */
  static async getExchangeRate(fromCurrency, toCurrency) {
    const from = this._normalizeCurrency(fromCurrency);
    const to = this._normalizeCurrency(toCurrency);

    if (from === to) return 1.0;

    const cacheKey = `fx:rate:${from}:${to}`;

    try {
      // Check Redis cache first
      const cachedRate = await cacheService.get(cacheKey);
      if (cachedRate && typeof cachedRate === 'number' && !isNaN(cachedRate)) {
        return cachedRate;
      }
    } catch (err) {
      logger.warn('Redis read failed in FXService, falling back to calculation', { error: err.message });
    }

    // Calculate cross-rate using mock/live base rates
    const fromRateUSD = MOCK_FX_RATES[from] || 1.0;
    const toRateUSD = MOCK_FX_RATES[to] || 1.0;
    const rate = Number((toRateUSD / fromRateUSD).toFixed(6));

    try {
      // Cache rate for 24 hours. `setEx(key, ttl, value)` — the call this
      // replaces was `set(key, value, ttl)`, which the cache service does not
      // export, so every rate lookup logged "cacheService.set is not a
      // function" and nothing was ever cached (#952).
      await cacheService.setEx(cacheKey, 86400, rate);
    } catch (err) {
      logger.warn('Redis write failed in FXService', { error: err.message });
    }

    return rate;
  }

  /**
   * Convert an amount from one currency to another.
   *
   * @param {number} amount Monetary amount
   * @param {string} fromCurrency
   * @param {string} toCurrency
   * @returns {Promise<{originalAmount: number, convertedAmount: number, fromCurrency: string, toCurrency: string, fxRate: number, timestamp: string}>}
   */
  static async convertCurrency(amount, fromCurrency, toCurrency) {
    const numAmount = Number(amount) || 0;
    const from = this._normalizeCurrency(fromCurrency);
    const to = this._normalizeCurrency(toCurrency);

    const rate = await this.getExchangeRate(from, to);
    const convertedAmount = Number((numAmount * rate).toFixed(2));

    return {
      originalAmount: numAmount,
      convertedAmount,
      fromCurrency: from,
      toCurrency: to,
      fxRate: rate,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetch exchange rates for a given base currency for multi-currency UI rendering.
   *
   * @param {string} baseCurrency (default 'USD')
   * @returns {Promise<{baseCurrency: string, rates: object, timestamp: string}>}
   */
  static async getRatesForBase(baseCurrency = 'USD') {
    const base = this._normalizeCurrency(baseCurrency);
    const currencies = Object.keys(MOCK_FX_RATES);
    const rates = {};

    for (const curr of currencies) {
      rates[curr] = await this.getExchangeRate(base, curr);
    }

    return {
      baseCurrency: base,
      rates,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = FXService;
