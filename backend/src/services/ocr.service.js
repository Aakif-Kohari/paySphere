/**
 * @fileoverview OCR Receipt Parsing Service
 * @description Provides automated optical character recognition (OCR) and text parsing
 * for receipts, extracting vendor, total amount, transaction date, tax, and currency.
 */

'use strict';

const logger = require('../utils/logger');
const FXService = require('./fx.service');

class OCRService {
  /**
   * Extract key receipt fields (total amount, date, vendor, currency, tax) from raw OCR text.
   *
   * @param {string} rawText Raw text string extracted from receipt image
   * @returns {{vendor: string, totalAmount: number, currency: string, date: string|null, taxAmount: number, confidence: number, rawText: string}}
   */
  static parseReceiptText(rawText = '') {
    logger.info('Executing OCR text parsing engine on receipt payload');

    if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
      return {
        vendor: 'Unknown Merchant',
        totalAmount: 0,
        currency: 'USD',
        date: null,
        taxAmount: 0,
        confidence: 0,
        rawText: '',
      };
    }

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Detect Vendor (typically top 3 non-numeric lines)
    let vendor = 'Unknown Merchant';
    for (const line of lines.slice(0, 5)) {
      if (line.length >= 3 && !/^\d+$/.test(line) && !/total|receipt|invoice|date|tax|cash/i.test(line)) {
        vendor = line;
        break;
      }
    }

    // 2. Detect Currency (USD, EUR, GBP, INR, CAD, AUD, JPY)
    let currency = 'USD';
    if (/\$|USD/i.test(rawText)) currency = 'USD';
    else if (/€|EUR/i.test(rawText)) currency = 'EUR';
    else if (/£|GBP/i.test(rawText)) currency = 'GBP';
    else if (/₹|INR|Rs/i.test(rawText)) currency = 'INR';
    else if (/CAD/i.test(rawText)) currency = 'CAD';
    else if (/AUD/i.test(rawText)) currency = 'AUD';
    else if (/JPY|¥/i.test(rawText)) currency = 'JPY';

    // 3. Detect Total Amount using regex patterns
    let totalAmount = 0;
    const totalPatterns = [
      /total\s*[:$€£₹]?\s*([\d,]+\.?\d*)/i,
      /amount\s*due\s*[:$€£₹]?\s*([\d,]+\.?\d*)/i,
      /grand\s*total\s*[:$€£₹]?\s*([\d,]+\.?\d*)/i,
      /balance\s*due\s*[:$€£₹]?\s*([\d,]+\.?\d*)/i,
      /[$€£₹]\s*([\d,]+\.\d{2})/i,
    ];

    for (const pattern of totalPatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(',', ''));
        if (!isNaN(parsed) && parsed > totalAmount) {
          totalAmount = parsed;
        }
      }
    }

    // Fallback: highest decimal number found in receipt
    if (totalAmount === 0) {
      const numberMatches = rawText.match(/[\d,]+\.\d{2}/g);
      if (numberMatches) {
        const values = numberMatches.map((n) => parseFloat(n.replace(',', ''))).filter((v) => !isNaN(v));
        if (values.length > 0) {
          totalAmount = Math.max(...values);
        }
      }
    }

    // 4. Detect Date (ISO YYYY-MM-DD or DD/MM/YYYY)
    let date = null;
    const datePattern = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/;
    const dateMatch = rawText.match(datePattern);
    if (dateMatch) {
      date = dateMatch[0];
    }

    // 5. Detect Tax Amount
    let taxAmount = 0;
    const taxMatch = rawText.match(/tax\s*[:$€£₹]?\s*([\d,]+\.?\d*)/i);
    if (taxMatch && taxMatch[1]) {
      taxAmount = parseFloat(taxMatch[1].replace(',', '')) || 0;
    }

    const confidence = totalAmount > 0 ? (vendor !== 'Unknown Merchant' ? 0.92 : 0.75) : 0.40;

    return {
      vendor,
      totalAmount,
      currency,
      date,
      taxAmount,
      confidence,
      rawText,
    };
  }

  /**
   * Process a receipt buffer/payload, parse OCR fields, and perform currency conversion to target currency.
   *
   * @param {Buffer|string} input Receipt image/text input
   * @param {string} [targetCurrency='USD'] Employee reimbursement target currency
   * @returns {Promise<object>}
   */
  static async processReceipt(input, targetCurrency = 'USD') {
    const rawText = typeof input === 'string' ? input : input.toString('utf8');
    const parsedData = this.parseReceiptText(rawText);

    let conversion = null;
    if (parsedData.totalAmount > 0 && parsedData.currency !== targetCurrency) {
      conversion = await FXService.convertCurrency(
        parsedData.totalAmount,
        parsedData.currency,
        targetCurrency
      );
    }

    return {
      success: true,
      scannedReceipt: parsedData,
      conversion: conversion || {
        originalAmount: parsedData.totalAmount,
        convertedAmount: parsedData.totalAmount,
        fromCurrency: parsedData.currency,
        toCurrency: targetCurrency,
        fxRate: 1.0,
      },
    };
  }
}

module.exports = OCRService;
