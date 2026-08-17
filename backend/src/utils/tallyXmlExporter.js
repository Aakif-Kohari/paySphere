/**
 * @fileoverview Tally TDL9 XML Exporter
 * @description Formats journal legs into the strict XML schema required for 
 * direct import into Tally Prime via the TDL9 interface.
 * Issue: #986
 */

/**
 * Escapes special XML characters to prevent parsing errors in Tally.
 * @param {string} str 
 * @returns {string}
 */
function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generates Tally Prime compatible XML for a Journal Voucher.
 * 
 * @param {Object} voucher - The JournalVoucher document
 * @returns {string} TDL9 XML string
 */
function generateTallyXml(voucher) {
    const dateStr = `${voucher.voucherDate.getFullYear()}${String(voucher.voucherDate.getMonth() + 1).padStart(2, '0')}${String(voucher.voucherDate.getDate()).padStart(2, '0')}`;

    let ledgerEntries = '';
    for (const leg of voucher.legs) {
        const amountStr = leg.nature === 'Credit' ? `-${leg.amount.toFixed(2)}` : leg.amount.toFixed(2);

        ledgerEntries += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(leg.glAccountName)}</LEDGERNAME>
        <GSTCLASS/>
        <ISDEEMEDPOSITIVE>${leg.nature === 'Debit' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
        <LEDGERFROMITEM>No</LEDGERFROMITEM>
        <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
        <ISPARTYLEDGER>No</ISPARTYLEDGER>
        <ISDEEMEDPOSITIVE>${leg.nature === 'Debit' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
        <AMOUNT>${amountStr}</AMOUNT>
        <NARRATION>${escapeXml(leg.narration)}</NARRATION>
      </ALLLEDGERENTRIES.LIST>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(voucher.tenantId.toString())}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(voucher.voucherNumber)}</VOUCHERNUMBER>
            <NARRATION>${escapeXml(`Being payroll journal for month ${voucher.month}/${voucher.year}`)}</NARRATION>
            <ISINVOICE>No</ISINVOICE>
            ${ledgerEntries}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return xml;
}

/**
 * Generates a standard CSV export for generic ERP systems (QuickBooks, SAP).
 * @param {Object} voucher 
 * @returns {string} CSV content
 */
function generateGenericCsv(voucher) {
    const headers = ['Date', 'Voucher Number', 'GL Account', 'GL Code', 'Debit', 'Credit', 'Narration'];
    const rows = voucher.legs.map(leg => [
        voucher.voucherDate.toISOString().split('T')[0],
        voucher.voucherNumber,
        `"${leg.glAccountName}"`,
        leg.glAccountCode || '',
        leg.nature === 'Debit' ? leg.amount.toFixed(2) : '0.00',
        leg.nature === 'Credit' ? leg.amount.toFixed(2) : '0.00',
        `"${leg.narration}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

module.exports = { generateTallyXml, generateGenericCsv };
