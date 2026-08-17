/**
 * @fileoverview OCR Service Wrapper & Parsing Engine
 * @description Simulates OCR extraction from receipt images and provides automated 
 * text parsing for receipts, extracting vendor, total amount, transaction date, tax, and currency.
 * In production, extractReceiptData would integrate with AWS Textract, Google Cloud Vision, or Tesseract.js.
 * Issue: #1082
 */

'use strict';

const logger = require('../utils/logger');
const FXService = require('./fx.service');

/**
 * Mock OCR extraction function.
 * Parses receipt images to extract merchant, date, total, and confidence score.
 * 
 * @param {string} imageUrl - URL or base64 string of the receipt image
 * @returns {Promise<{merchant: string, date: Date, total: number, confidence: number, rawText: string}>}
 */
async function extractReceiptData(imageUrl) {
  // Simulate network/processing delay
  await new Promise(resolve => setTimeout(resolve, 800));

  logger.info(`[OCR] Processing receipt: ${imageUrl}`);

  // Mock extraction logic based on "image" characteristics
  // In a real app, this would call an external API and parse the JSON response
  const mockData = [
    { merchant: 'Starbucks Coffee', date: new Date('2026-08-10'), total: 450.00, confidence: 0.95 },
    { merchant: 'Uber Trip', date: new Date('2026-08-12'), total: 850.50, confidence: 0.88 },
    { merchant: 'Amazon Web Services', date: new Date('2026-08-01'), total: 12500.00, confidence: 0.99 },
    { merchant: 'Local Restaurant', date: new Date('2026-08-14'), total: 2400.00, confidence: 0.75 }
  ];

  // Randomly select a mock receipt to simulate OCR variance
  const extracted = mockData[Math.floor(Math.random() * mockData.length)];
  
  const rawText = `
    RECEIPT
    Merchant: ${extracted.merchant}
    Date: ${extracted.date.toISOString().split('T')[0]}
    Items:
    - Item 1: ${extracted.total * 0.8}
    - Tax: ${extracted.total * 0.2}
    TOTAL: ${extracted.total}
    Thank you for your business!
  `;

  return {
    merchant: extracted.merchant,
    date: extracted.date,
    total: extracted.total,
    confidence: extracted.confidence,
    rawText: rawText.trim()
  };
}

/**
 * Validates if the OCR confidence is high enough to trust the extracted data.
 * @param {number} confidence - 0.0 to 1.0
 * @returns {boolean}
 */
function isConfidenceReliable(confidence) {
  return confidence >= 0.80;
}

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
   * Supports both raw text strings and image URLs/base64 (via mock OCR extraction).
   *
   * @param {Buffer|string} input Receipt image URL, base64 string, or raw text
   * @param {string} [targetCurrency='USD'] Employee reimbursement target currency
   * @returns {Promise<object>}
   */
  static async processReceipt(input, targetCurrency = 'USD') {
    let rawText;
    let ocrConfidence = null;

    // Determine if input is an image reference or raw text
    if (typeof input === 'string' && (input.startsWith('http') || input.startsWith('data:') || input.length > 500)) {
      // Treat as image URL or base64 - use OCR extraction
      const ocrResult = await extractReceiptData(input);
      rawText = ocrResult.rawText;
      ocrConfidence = ocrResult.confidence;
      
      logger.info(`[OCR] Extraction complete. Confidence: ${ocrConfidence}. Reliable: ${isConfidenceReliable(ocrConfidence)}`);
    } else {
      // Treat as raw text or buffer
      rawText = typeof input === 'string' ? input : input.toString('utf8');
    }

    const parsedData = this.parseReceiptText(rawText);

    // Override confidence with OCR engine confidence if available and lower
    if (ocrConfidence !== null && ocrConfidence < parsedData.confidence) {
      parsedData.confidence = ocrConfidence;
    }

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
module.exports.extractReceiptData = extractReceiptData;
module.exports.isConfidenceReliable = isConfidenceReliable;
