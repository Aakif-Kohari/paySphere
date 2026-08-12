'use strict';

const FXService = require('../fx.service');

describe('FXService', () => {
  describe('getExchangeRate', () => {
    it('should return 1.0 when converting identical currencies', async () => {
      const rate = await FXService.getExchangeRate('USD', 'USD');
      expect(rate).toBe(1.0);
    });

    it('should return cross exchange rate for supported currency pairs', async () => {
      const rateUSD_EUR = await FXService.getExchangeRate('USD', 'EUR');
      expect(rateUSD_EUR).toBeGreaterThan(0);
      expect(rateUSD_EUR).toBeLessThan(2.0);
    });

    it('should handle case insensitivity and whitespace', async () => {
      const rate = await FXService.getExchangeRate(' usd ', ' eur ');
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('convertCurrency', () => {
    it('should accurately calculate converted amount and return audit metadata', async () => {
      const result = await FXService.convertCurrency(100, 'USD', 'INR');
      expect(result.originalAmount).toBe(100);
      expect(result.convertedAmount).toBeGreaterThan(100);
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('INR');
      expect(result.fxRate).toBeGreaterThan(0);
      expect(typeof result.timestamp).toBe('string');
    });

    it('should default missing or invalid amount to zero', async () => {
      const result = await FXService.convertCurrency(null, 'USD', 'EUR');
      expect(result.originalAmount).toBe(0);
      expect(result.convertedAmount).toBe(0);
    });
  });

  describe('getRatesForBase', () => {
    it('should return full exchange rate dictionary for a base currency', async () => {
      const data = await FXService.getRatesForBase('USD');
      expect(data.baseCurrency).toBe('USD');
      expect(data.rates).toHaveProperty('USD', 1.0);
      expect(data.rates).toHaveProperty('EUR');
      expect(data.rates).toHaveProperty('GBP');
      expect(data.rates).toHaveProperty('INR');
    });
  });
});
