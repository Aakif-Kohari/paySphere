const logger = require('./logger');

/**
 * Parses a challan PDF receipt buffer to extract currency figures and tax IDs.
 * Utilizes pdf-parse dynamically if installed, falling back to buffer-to-string parsing.
 * 
 * @param {Buffer} pdfBuffer - The uploaded PDF file buffer
 * @returns {Promise<{ amount: number, taxId: string, notes: string }>} Mapped figures
 */
async function parseChallanPdf(pdfBuffer) {
  if (!pdfBuffer) {
    return { amount: 0, taxId: '', notes: 'No file buffer provided' };
  }

  let rawText = '';
  try {
    const pdf = require('pdf-parse');
    const data = await pdf(pdfBuffer);
    rawText = data.text;
  } catch (err) {
    // Fallback if pdf-parse is not installed or error occurs
    rawText = pdfBuffer.toString('utf8');
  }

  logger.info('[Challan Parser] Extracted raw text from file', { length: rawText.length });

  // 1. Extract Amount
  // Matches: Total: 15000, Amount: 15,000.50, Paid Amount: INR 25000, etc.
  const amountRegexes = [
    /total(?:[\s_]*challan[\s_]*amount)?[\s:]*(?:inr|usd)?[\s]*([0-9,]+(?:\.[0-9]{2})?)/i,
    /amount[\s:]*(?:inr|usd)?[\s]*([0-9,]+(?:\.[0-9]{2})?)/i,
    /paid[\s:]*(?:inr|usd)?[\s]*([0-9,]+(?:\.[0-9]{2})?)/i
  ];

  let amount = 0;
  for (const regex of amountRegexes) {
    const match = rawText.match(regex);
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // 2. Extract Tax ID / Challan Number / TRRN
  // Matches: Challan No: 123456, Tax ID: ABCDE1234F, TRRN: 101234567890
  const taxIdRegexes = [
    /trrn[\s:]*([a-z0-9_-]+)/i,
    /challan[\s_-]*(?:no|id)[\s:]*([a-z0-9_-]+)/i,
    /tax[\s_-]*id[\s:]*([a-z0-9_-]+)/i,
    /tin[\s:]*([a-z0-9_-]+)/i
  ];

  let taxId = '';
  for (const regex of taxIdRegexes) {
    const match = rawText.match(regex);
    if (match) {
      taxId = match[1].trim();
      break;
    }
  }

  return {
    amount,
    taxId,
    notes: `Extracted total amount: ${amount}, Tax/Challan ID: ${taxId}`
  };
}

module.exports = {
  parseChallanPdf
};
