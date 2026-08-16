const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema(
  {
    baseCurrency: {
      type: String,
      required: true,
      default: 'USD',
    },
    rates: {
      type: Map,
      of: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      unique: true,
      default: () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        return today;
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);
