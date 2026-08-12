'use strict';

const OCRService = require('../ocr.service');

describe('OCRService', () => {
  const sampleReceiptText = `
    Acme Coffee Shop
    123 Main Street
    Date: 2026-08-10
    
    1x Espresso - $4.50
    1x Croissant - $3.50
    
    Subtotal: $8.00
    Tax: $0.80
    TOTAL: $8.80
    
    Thank you for visiting!
  `;

  describe('parseReceiptText', () => {
    it('should parse vendor, total amount, tax amount, date, and currency', () => {
      const parsed = OCRService.parseReceiptText(sampleReceiptText);

      expect(parsed.vendor).toBe('Acme Coffee Shop');
      expect(parsed.totalAmount).toBe(8.8);
      expect(parsed.currency).toBe('USD');
      expect(parsed.date).toBe('2026-08-10');
      expect(parsed.taxAmount).toBe(0.8);
      expect(parsed.confidence).toBeGreaterThan(0.7);
    });

    it('should handle empty or whitespace text input gracefully', () => {
      const parsed = OCRService.parseReceiptText('   ');
      expect(parsed.totalAmount).toBe(0);
      expect(parsed.vendor).toBe('Unknown Merchant');
      expect(parsed.confidence).toBe(0);
    });

    it('should detect foreign currencies (EUR, GBP, INR)', () => {
      const eurText = 'Bistro Paris\nTotal: €45.50\nDate: 2026-08-11';
      const parsedEur = OCRService.parseReceiptText(eurText);
      expect(parsedEur.currency).toBe('EUR');
      expect(parsedEur.totalAmount).toBe(45.5);

      const inrText = 'Chai Point\nGrand Total: ₹350.00\nDate: 2026-08-11';
      const parsedInr = OCRService.parseReceiptText(inrText);
      expect(parsedInr.currency).toBe('INR');
      expect(parsedInr.totalAmount).toBe(350);
    });
  });

  describe('processReceipt', () => {
    it('should process receipt and return conversion payload when target currency differs', async () => {
      const eurText = 'Bistro Paris\nTotal: €100.00\nDate: 2026-08-11';
      const result = await OCRService.processReceipt(eurText, 'USD');

      expect(result.success).toBe(true);
      expect(result.scannedReceipt.currency).toBe('EUR');
      expect(result.scannedReceipt.totalAmount).toBe(100);
      expect(result.conversion).toBeDefined();
      expect(result.conversion.toCurrency).toBe('USD');
      expect(result.conversion.convertedAmount).toBeGreaterThan(0);
    });
  });
});
