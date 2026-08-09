class FXService {
  static async getExchangeRate(fromCurrency, toCurrency) {
    // External FX API stub
    if (fromCurrency === toCurrency) return 1;
    return 1.15;
  }
}
module.exports = FXService;
