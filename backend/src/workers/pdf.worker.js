const { workerData, parentPort } = require("worker_threads");
const PDFDocument = require("pdfkit");

async function generatePDF() {
  try {
    const { payrolls, companyName, companyLogoData, monthName, year } = workerData;

    // We will collect the PDF chunks in an array to send back as a buffer
    const chunks = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });

    doc.on("end", () => {
      const result = Buffer.concat(chunks);
      parentPort.postMessage({ success: true, buffer: result });
    });

    
    // --- Company Logo ---
    if (companyLogoData && companyLogoData.startsWith("data:image")) {
      try {
        const base64Data = companyLogoData.split(',')[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 40, 40, { width: 50 });
      } catch (e) {
        console.error("Failed to draw logo:", e);
      }
    }

    // --- Company Header ---
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text(companyName, { align: "center" });

    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Payroll Summary Report — ${monthName} ${year}`, {
        align: "center",
      });

    doc.moveDown(0.5);

    // Divider line
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    doc.moveDown(1);

    // --- Summary Section ---
    const totalPayout = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
    const totalBase = payrolls.reduce((sum, p) => sum + p.baseSalary, 0);
    const totalOvertime = payrolls.reduce((sum, p) => sum + p.overtimePay, 0);
    const totalBonus = payrolls.reduce((sum, p) => sum + p.bonus, 0);
    const totalDeductions = payrolls.reduce(
      (sum, p) => sum + p.deductions + p.leaveDeduction,
      0,
    );

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("Financial Summary");

    doc.moveDown(0.3);

    const summaryData = [
      ["Total Employees", String(payrolls.length)],
      ["Total Base Salary", `Rs. ${totalBase.toLocaleString("en-IN")}`],
      ["Total Overtime Pay", `Rs. ${totalOvertime.toLocaleString("en-IN")}`],
      ["Total Bonuses", `Rs. ${totalBonus.toLocaleString("en-IN")}`],
      ["Total Deductions", `Rs. ${totalDeductions.toLocaleString("en-IN")}`],
      ["Net Payout", `Rs. ${totalPayout.toLocaleString("en-IN")}`],
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

      // Alternating row background
      if (idx % 2 === 0) {
        doc.rect(startX, rowY - 2, 515, 14).fill("#f9fafb");
      }

      const rowData = [
        p.employeeName,
        `Rs. ${p.baseSalary.toLocaleString("en-IN")}`,
        String(p.leaveDays),
        `Rs. ${p.overtimePay.toLocaleString("en-IN")}`,
        `Rs. ${p.bonus.toLocaleString("en-IN")}`,
        `Rs. ${(p.deductions + p.leaveDeduction).toLocaleString("en-IN")}`,
        `Rs. ${p.netSalary.toLocaleString("en-IN")}`,
      ];

      xPos = startX + 5;
      rowData.forEach((cell, i) => {
        doc
          .fontSize(8)
          .font(i === 0 ? "Helvetica" : "Helvetica")
          .fillColor("#444444")
          .text(cell, xPos, rowY, { width: colWidths[i] });
        xPos += colWidths[i];
      });

      doc.y = rowY + 14;
    });

    // Table footer / totals
    doc.moveDown(0.5);
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + 515, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();

    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text(`Total Payout: Rs. ${totalPayout.toLocaleString("en-IN")}`, startX, doc.y, {
        align: "right",
      });

    // --- Footer ---
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#aaaaaa")
        .text(
          `Generated by PaySphere • Page ${i + 1} of ${pageCount}`,
          40,
          doc.page.height - 30,
          { align: "center", width: 515 },
        );
    }

    doc.end();
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
}

generatePDF();
