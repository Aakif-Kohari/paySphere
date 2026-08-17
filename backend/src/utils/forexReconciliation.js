/**
 * @fileoverview Forex Reconciliation & Accounts Receivable (AR) Aging Engine
 * @description Calculates realized/unrealized forex gains/losses, invoice aging buckets (0-30, 31-60, 61-90, 90+ days),
 * overdue penalty interest, and automated dunning escalation workflows.
 */

'use strict';

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
    realizedGainLoss: Math.round(realizedGainLoss * 100) / 100,
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
 * 
 * @param {string} fromCurrency - e.g., 'USD'
 * @param {string} toCurrency - e.g., 'INR'
 * @returns {Promise<number>} The exchange rate
 */
async function getExchangeRate(fromCurrency, toCurrency) {
  const mockRates = {
    'USD_INR': 83.50,
    'EUR_INR': 90.20,
    'GBP_INR': 105.40,
    'AED_INR': 22.75,
  };

  const key = `${fromCurrency}_${toCurrency}`;
  return mockRates[key] || 1;
}

/**
 * Categorizes a list of open invoices into standardized AR aging buckets.
 * 
 * @param {Array<object>} invoices List of open invoice records
 * @param {Date|string} [referenceDate] Valuation date (defaults to now)
 * @returns {object} Aggregated aging analysis
 */
function calculateAgingBuckets(invoices = [], referenceDate = new Date()) {
  const refTime = new Date(referenceDate).getTime();

  const buckets = {
    current: { count: 0, totalAmount: 0, invoices: [] },     // 0-30 days
    days31to60: { count: 0, totalAmount: 0, invoices: [] },  // 31-60 days
    days61to90: { count: 0, totalAmount: 0, invoices: [] },  // 61-90 days
    daysOver90: { count: 0, totalAmount: 0, invoices: [] },  // 91+ days
  };

  let grandTotalOutstanding = 0;

  for (const inv of invoices) {
    const invDate = new Date(inv.invoiceDate || inv.createdAt).getTime();
    const diffDays = Math.max(0, Math.floor((refTime - invDate) / (1000 * 60 * 60 * 24)));
    const openAmount = Number(inv.inrEquivalent || inv.amount || 0) - Number(inv.amountReceivedINR || 0);

    if (openAmount <= 0) continue;

    grandTotalOutstanding += openAmount;
    const invSummary = {
      id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      openAmount: Math.round(openAmount * 100) / 100,
      ageDays: diffDays,
      dunningStage: getDunningStage(diffDays),
    };

    if (diffDays <= 30) {
      buckets.current.count++;
      buckets.current.totalAmount += openAmount;
      buckets.current.invoices.push(invSummary);
    } else if (diffDays <= 60) {
      buckets.days31to60.count++;
      buckets.days31to60.totalAmount += openAmount;
      buckets.days31to60.invoices.push(invSummary);
    } else if (diffDays <= 90) {
      buckets.days61to90.count++;
      buckets.days61to90.totalAmount += openAmount;
      buckets.days61to90.invoices.push(invSummary);
    } else {
      buckets.daysOver90.count++;
      buckets.daysOver90.totalAmount += openAmount;
      buckets.daysOver90.invoices.push(invSummary);
    }
  }

  return {
    totalOutstanding: Math.round(grandTotalOutstanding * 100) / 100,
    buckets: {
      current: { ...buckets.current, totalAmount: Math.round(buckets.current.totalAmount * 100) / 100 },
      days31to60: { ...buckets.days31to60, totalAmount: Math.round(buckets.days31to60.totalAmount * 100) / 100 },
      days61to90: { ...buckets.days61to90, totalAmount: Math.round(buckets.days61to90.totalAmount * 100) / 100 },
      daysOver90: { ...buckets.daysOver90, totalAmount: Math.round(buckets.daysOver90.totalAmount * 100) / 100 },
    },
  };
}

/**
 * Calculates overdue penalty interest on an unpaid invoice.
 *
 * @param {number} outstandingAmount
 * @param {number} overdueDays
 * @param {number} [annualInterestRate=18] Annual penalty percentage (e.g. 18% p.a.)
 * @returns {number}
 */
function calculateOverdueInterest(outstandingAmount, overdueDays, annualInterestRate = 18) {
  if (outstandingAmount <= 0 || overdueDays <= 0) return 0;
  const interest = (outstandingAmount * (annualInterestRate / 100) * overdueDays) / 365;
  return Math.round(interest * 100) / 100;
}

/**
 * Determine dunning escalation stage based on invoice age.
 *
 * @param {number} ageDays
 * @returns {string} 'CURRENT'|'REMINDER'|'WARNING'|'FINAL_NOTICE'|'DEFAULTED'
 */
function getDunningStage(ageDays) {
  if (ageDays <= 30) return 'CURRENT';
  if (ageDays <= 60) return 'REMINDER';
  if (ageDays <= 90) return 'WARNING';
  if (ageDays <= 120) return 'FINAL_NOTICE';
  return 'DEFAULTED';
}

module.exports = {
  calculateRealizedGainLoss,
  calculateUnrealizedGainLoss,
  getExchangeRate,
  calculateAgingBuckets,
  calculateOverdueInterest,
  getDunningStage,
};
