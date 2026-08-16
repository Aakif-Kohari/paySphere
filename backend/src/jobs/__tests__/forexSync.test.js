const { runForexSyncJob, fetchRatesFromApi, getFallbackRates } = require('../forexSync.job');
const ExchangeRate = require('../../models/exchangeRate.model');

// Mock ExchangeRate model
jest.mock('../../models/exchangeRate.model', () => {
  return {
    findOneAndUpdate: jest.fn().mockImplementation((query, update) => {
      return Promise.resolve({
        date: query.date,
        baseCurrency: update.baseCurrency || 'USD',
        rates: update.rates,
      });
    }),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Daily Forex Sync Job (#1093)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getFallbackRates should return default USD rates', () => {
    const fallback = getFallbackRates();
    expect(fallback.baseCurrency).toBe('USD');
    expect(fallback.rates.INR).toBe(83.50);
    expect(fallback.rates.EUR).toBe(0.92);
  });

  test('fetchRatesFromApi should resolve fallback rates on network error/mocking', async () => {
    const rates = await fetchRatesFromApi();
    expect(rates.baseCurrency).toBe('USD');
    expect(rates.rates).toBeDefined();
  });

  test('runForexSyncJob should correctly query, fetch, and upsert daily rates', async () => {
    const result = await runForexSyncJob();

    expect(result).toBeDefined();
    expect(ExchangeRate.findOneAndUpdate).toHaveBeenCalled();
    expect(result.baseCurrency).toBe('USD');
    expect(result.rates.get ? result.rates.get('INR') : result.rates['INR']).toBe(83.50);
  });
});
