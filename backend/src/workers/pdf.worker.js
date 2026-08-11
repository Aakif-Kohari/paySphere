const { workerData, parentPort } = require("worker_threads");
const PDFDocument = require("pdfkit");
const { formatCurrency } = require("../utils/currency");

/**
 * Generates Form 16 (Part A & Part B) PDF
 * @param {Object} payload - { employee, employer, fyStartYear }
 */
async function handleForm16Generation(payload) {
  const { employee, employer, fyStartYear } = payload;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const buffers = [];

  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => {
    parentPort.postMessage({ success: true, pdfData: Buffer.concat(buffers) });
  });

  const drawTable = (startY, headers, rows) => {
    let y = startY;
    const colWidth = 250;

    // Header
    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((h, i) => {
      doc.text(h, 50 + (i * colWidth), y, { width: colWidth, align: 'left' });
    });
    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke('#000');
    y += 5;

    // Rows
    doc.font('Helvetica').fontSize(9);
    rows.forEach(row => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      row.forEach((cell, i) => {
        doc.text(String(cell), 50 + (i * colWidth), y, { width: colWidth, align: i === 1 ? 'right' : 'left' });
      });
      y += 15;
    });
    return y;
  };

  // --- PART A ---
  doc.fontSize(16).font('Helvetica-Bold').text('FORM NO. 16', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('[See Rule 31]', { align: 'center' });
  doc.moveDown(0.5);
  doc.text('Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12).font('Helvetica-Bold').text(`PART A`);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Name and address of the employer: ${employer.companyName}`);
  doc.text(`TAN of the employer: ${employer.tan}`);
  doc.text(`PAN of the employer: ${employer.pan}`);
  doc.moveDown(0.5);
  doc.text(`Name and address of the employee: ${employee.employeeName}`);
  doc.text(`PAN of the employee: ${employee.pan}`);
  doc.moveDown(0.5);
  doc.text(`Assessment Year: ${fyStartYear + 1}-${String(fyStartYear + 2).slice(-2)}`);
  doc.text(`Financial Year: ${fyStartYear}-${fyStartYear + 1}`);

  doc.moveDown(2);

  // --- PART B ---
  doc.addPage();
  doc.fontSize(12).font('Helvetica-Bold').text('PART B (Annexure II)');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text('Details of salary and tax deducted at source');
  doc.moveDown(1);

  const headers = ['Description', 'Amount (₹)'];
  const rows = [
    ['Gross Salary (Section 17(1))', employee.grossSalary],
    ['Perquisites (Section 17(2))', employee.perquisites],
    ['Profits in lieu of salary (Section 17(3))', 0],
    ['Total Gross Income', employee.grossSalary + employee.perquisites],
    ['Less: Standard Deduction (Section 16(ia))', 50000],
    ['Less: Professional Tax', employee.professionalTax],
    ['Net Taxable Income', employee.netTaxableIncome],
    ['Total Tax Deducted at Source (TDS)', employee.totalTDS],
  ];

  drawTable(doc.y, headers, rows);

  doc.moveDown(3);
  doc.fontSize(10).font('Helvetica').text('This is to certify that the information given above is correct.', { align: 'center' });
  doc.moveDown(2);
  doc.text('___________________________', 400, doc.y);
  doc.text('Authorized Signatory', 420, doc.y + 5);

  doc.end();
}

/**
 * Generates company-wide payroll summary report PDF
 */
async function handleCompanyReportGeneration(payload) {
  const { payrolls, employeeMap, companyName, companyLogo, monthName, year, totalBase, totalOvertime, totalBonus, totalDeductions, totalPayout, currency = "INR" } = payload;

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdfData = Buffer.concat(buffers);
    parentPort.postMessage({ success: true, pdfData });
  });

  // --- Company Header ---
  if (companyLogo) {
    try {
      const logoBuffer = Buffer.from(companyLogo.replace(/^data:image\/\w+;base64,/, ""), 'base64');
      doc.image(logoBuffer, 40, 30, { fit: [50, 50] });
    } catch (error) { console.error(error); }
  }
  doc.fontSize(22).font("Helvetica-Bold").fillColor("#1e3a5f").text(companyName, { align: "center" });
  doc.fontSize(12).font("Helvetica").fillColor("#666666").text(`Payroll Summary Report — ${monthName} ${year}`, { align: "center" });
  doc.moveDown(0.5);

  // Divider line
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").lineWidth(1).stroke();
  doc.moveDown(1);

  // --- Summary Section ---
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#333333").text("Financial Summary");
  doc.moveDown(0.3);

  const summaryData = [
    ["Total Employees", String(payrolls.length)],
    ["Total Base Salary", formatCurrency(totalBase, currency)],
    ["Total Overtime Pay", formatCurrency(totalOvertime, currency)],
    ["Total Bonuses", formatCurrency(totalBonus, currency)],
    ["Total Deductions", formatCurrency(totalDeductions, currency)],
    ["Net Payout", formatCurrency(totalPayout, currency)],
  ];

  summaryData.forEach(([label, value]) => {
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#555555")
      .text(label, 60, doc.y, { continued: true, width: 200 });
    doc
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text(`  ${value}`, { align: "right" });
    doc.moveDown(0.2);
  });

  doc.moveDown(1);

  // --- Employee Payroll Table ---
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#333333")
    .text("Employee Payroll Details");

  doc.moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  const colWidths = [110, 65, 55, 60, 55, 55, 65];
  const colLabels = [
    "Employee",
    "Base",
    "Leave",
    "Overtime",
    "Bonus",
    "Deduct",
    "Net Pay",
  ];
  const startX = 40;

  // Header background
  doc
    .rect(startX, tableTop - 4, 515, 18)
    .fill("#e8edf3");

  let xPos = startX + 5;
  colLabels.forEach((label, i) => {
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text(label, xPos, tableTop, { width: colWidths[i] });
    xPos += colWidths[i];
  });

  doc.y = tableTop + 18;

  // Table rows
  payrolls.forEach((p, idx) => {
    if (doc.y > 750) {
      doc.addPage();
    }

    const rowY = doc.y;
    const emp = employeeMap[String(p.employeeId)];
    const role = emp?.role ? ` (${emp.role})` : "";

    // Alternating row background
    if (idx % 2 === 0) {
      doc.rect(startX, rowY - 2, 515, 14).fill("#f9fafb");
    }

    const rowData = [
      `${p.employeeName}${role}`,
      formatCurrency(p.baseSalary, currency),
      String(p.leaveDays),
      formatCurrency(p.overtimePay, currency),
      formatCurrency(p.bonus, currency),
      formatCurrency(p.deductions + p.leaveDeduction, currency),
      formatCurrency(p.netSalary, currency),
    ];

    xPos = startX + 5;
    rowData.forEach((cell, i) => {
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#444444")
        .text(cell, xPos, rowY, { width: colWidths[i] });
      xPos += colWidths[i];
    });

    doc.y = rowY + 14;
  });

  doc.moveDown(0.5);
  doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#1e3a5f").text(`Total Payout: ${formatCurrency(totalPayout, currency)}`, startX, doc.y, { align: "right" });

  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).font("Helvetica").fillColor("#aaaaaa").text(`Generated by PaySphere • Page ${i + 1} of ${pageCount}`, 40, doc.page.height - 30, { align: "center", width: 515 });
  }

  doc.end();
}

/**
 * Generates individual employee payslip PDF
 */
async function handlePayslipGeneration(payload) {
  const { employee, payroll, companyLogo, currency = "INR" } = payload;

  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdfData = Buffer.concat(buffers);
    parentPort.postMessage({ success: true, pdfData });
  });

  // Build PDF content
  if (companyLogo) {
    try {
      const logoBuffer = Buffer.from(companyLogo.replace(/^data:image\/\w+;base64,/, ""), 'base64');
      doc.image(logoBuffer, 50, 40, { fit: [50, 50] });
    } catch (error) { console.error(error); }
  }
  doc.fontSize(20).text("PaySphere", { align: "center" });
  doc.moveDown();
  doc.fontSize(16).text(`Payslip for ${payroll.month}/${payroll.year}`, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(12).text(`Employee Name: ${employee.fullName}`);
  doc.text(`Role: ${employee.role || "N/A"}`);
  doc.text(`Company: ${employee.companyName}`);
  doc.moveDown();

  doc.text(`Base Salary: ${formatCurrency(payroll.baseSalary, currency)}`);
  doc.text(`Leave Days: ${payroll.leaveDays} (-${formatCurrency(payroll.leaveDeduction, currency)})`);
  doc.text(`Overtime Hours: ${payroll.overtimeHours} (+${formatCurrency(payroll.overtimePay, currency)})`);
  doc.text(`Bonus: +${formatCurrency(payroll.bonus || 0, currency)}`);
  doc.text(`Deductions: -${formatCurrency(payroll.deductions || 0, currency)}`);

  // Issue #719: Render tax-free reimbursements distinctly
  if (payroll.reimbursements && payroll.reimbursements > 0) {
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#2563EB").text("Reimbursements (Tax-Free)");
    doc.fontSize(10).font("Helvetica").fillColor("#555555");
    doc.text(`Expense Reimbursements: +${formatCurrency(payroll.reimbursements, currency)}`);
  }

  doc.moveDown(1);

  doc.fontSize(14).text(`Net Salary: ${formatCurrency(payroll.netSalary, currency)}`, { underline: true });
  doc.end();
}

// Message-based worker entry point
parentPort.on('message', async (msg) => {
  try {
    switch (msg.type) {
      case 'GENERATE_COMPANY_REPORT':
        await handleCompanyReportGeneration(msg.payload);
        break;
      case 'GENERATE_PAYSLIP':
        await handlePayslipGeneration(msg.payload);
        break;
      case 'GENERATE_FORM_16': // Added for Issue #933
        await handleForm16Generation(msg.payload);
        break;
      default:
        parentPort.postMessage({
          success: false,
          error: `Unknown PDF generation type: ${msg.type}`,
        });
    }
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
});
