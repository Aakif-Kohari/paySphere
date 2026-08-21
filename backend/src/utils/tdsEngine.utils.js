/**
 * @fileoverview TDS Engine Utilities
 * @description Calculates TDS based on Section 194C/194J thresholds, PAN validity,
 * and Lower Deduction Certificates (LDC).
 * Issue: #1291
 */

// Statutory Thresholds (Simplified for FY 2026-27)
const THRESHOLDS = {
    '194C': { single: 30000, aggregate: 100000, rateIndividual: 1, rateOther: 2 },
    '194J': { single: 30000, aggregate: 30000, rate: 10 }, // Professional Fees
    '194I': { single: 240000, aggregate: 240000, rate: 10 }, // Rent
    '206AA': { rate: 20 } // Penalty for invalid/missing PAN
};

/**
 * Determines the Financial Year and Quarter for a given date.
 * @param {Date} date 
 * @returns {{ fy: string, quarter: string }}
 */
function getFinancialPeriod(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12

    let fyStart = year;
    if (month < 4) fyStart = year - 1; // Jan-Mar belongs to previous FY start year
    const fyEnd = fyStart + 1;
    const fy = `${fyStart}-${String(fyEnd).slice(-2)}`;

    let quarter = 'Q4';
    if (month >= 4 && month <= 6) quarter = 'Q1';
    else if (month >= 7 && month <= 9) quarter = 'Q2';
    else if (month >= 10 && month <= 12) quarter = 'Q3';

    return { fy, quarter };
}

/**
 * Calculates the TDS amount for a specific invoice.
 * 
 * @param {Object} vendor - VendorTDSProfile document
 * @param {number} invoiceAmount 
 * @param {number} fyAccumulation - Total payments made to this vendor in the current FY so far
 * @returns {{ tdsAmount: number, rate: number, section: string, reason: string }}
 */
function calculateTDS(vendor, invoiceAmount, fyAccumulation) {
    // 1. Check PAN Validity (Section 206AA)
    if (vendor.isPanInvalid || !vendor.pan) {
        const rate = THRESHOLDS['206AA'].rate;
        return {
            tdsAmount: Math.round(invoiceAmount * (rate / 100)),
            rate,
            section: '206AA',
            reason: 'PAN Invalid/Missing - Penal rate applied.'
        };
    }

    const config = THRESHOLDS[vendor.sectionType];
    if (!config) return { tdsAmount: 0, rate: 0, section: vendor.sectionType, reason: 'Unknown section' };

    // 2. Check Thresholds
    const totalAggregate = fyAccumulation + invoiceAmount;

    // For 194C, TDS is applicable if single > 30k OR aggregate > 1L
    // For 194J, TDS is applicable if aggregate > 30k
    let isApplicable = false;
    if (vendor.sectionType === '194C') {
        isApplicable = invoiceAmount > config.single || totalAggregate > config.aggregate;
    } else {
        isApplicable = totalAggregate > config.aggregate;
    }

    if (!isApplicable) {
        return { tdsAmount: 0, rate: 0, section: vendor.sectionType, reason: 'Below threshold.' };
    }

    // 3. Determine Rate (LDC vs Standard)
    let rate = vendor.standardRate || config.rate || config.rateOther || 2;
    let reason = 'Standard Rate';

    if (vendor.hasLDC && vendor.ldcValidUntil && new Date(vendor.ldcValidUntil) >= new Date()) {
        rate = vendor.ldcRate;
        reason = `Lower Deduction Certificate (${vendor.ldcCertificateNo}) applied.`;
    }

    // 4. Calculate Amount
    // Note: In some sections, TDS is on the whole amount once threshold is crossed.
    // For simplicity here, we apply it to the current invoice amount.
    const tdsAmount = Math.round(invoiceAmount * (rate / 100));

    return { tdsAmount, rate, section: vendor.sectionType, reason };
}

/**
 * Generates the pipe-delimited text content for Form 26Q.
 * Format: PAN|Name|Amount|TDS|Section|...
 * 
 * @param {Array} ledgerEntries - Array of TDSLedger documents
 * @param {string} deductorTan - Company's TAN
 * @returns {string}
 */
function generateForm26QText(ledgerEntries, deductorTan) {
    const lines = [];

    // Header (Mocked format for demonstration)
    lines.push(`#FORM26Q|${deductorTan}|${new Date().getFullYear()}`);

    for (const entry of ledgerEntries) {
        // Standardized row format
        // PAN | Name | Transaction Date | Amount | TDS | Section | Challan No (Mock)
        const row = [
            entry.vendorId.pan || 'INVALID',
            entry.vendorId.vendorName.replace(/\|/g, ' '),
            entry.invoiceDate.toISOString().split('T')[0],
            entry.grossAmount.toFixed(2),
            entry.tdsAmount.toFixed(2),
            entry.section,
            'CHALLAN_MOCK_001'
        ].join('|');

        lines.push(row);
    }

    return lines.join('\n');
}

module.exports = { calculateTDS, getFinancialPeriod, generateForm26QText };
