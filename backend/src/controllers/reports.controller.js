const PDFDocument = require("pdfkit");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const logger = require("../utils/logger");
const eventBus = require("../services/event.service");

// GET /api/reports/analytics
// Returns aggregated financial stats for the authenticated user's company
exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.userId;
    const monthsBack = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 12);

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    // Fetch all payroll records within the date range
    const payrolls = await PayrollUpdate.find({
      createdBy: userId,
      $or: [
        { year: { $gt: startDate.getFullYear() } },
        {
          year: startDate.getFullYear(),
          month: { $gte: startDate.getMonth() + 1 },
        },
      ],
    }).sort({ year: 1, month: 1 });

    // Fetch all employees for role breakdown
    const employees = await Employee.find({ createdBy: userId });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    // --- Monthly Payout Trends ---
    const monthlyMap = {};
    payrolls.forEach((p) => {
      const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          month: p.month,
          year: p.year,
          label: key,
          totalPayout: 0,
          totalBase: 0,
          totalOvertime: 0,
          totalBonus: 0,
          totalDeductions: 0,
          employeeCount: 0,
        };
      }
      monthlyMap[key].totalPayout += p.netSalary;
      monthlyMap[key].totalBase += p.baseSalary;
      monthlyMap[key].totalOvertime += p.overtimePay;
      monthlyMap[key].totalBonus += p.bonus;
      monthlyMap[key].totalDeductions += p.deductions + p.leaveDeduction;
      monthlyMap[key].employeeCount++;
    });

    const monthlyTrends = Object.values(monthlyMap).sort(
      (a, b) => a.year - b.year || a.month - b.month,
    );

    // --- Role / Department Breakdown ---
    const roleMap = {};
    payrolls.forEach((p) => {
      const emp = employeeMap[String(p.employeeId)];
      const role = emp?.role || "Unassigned";
      if (!roleMap[role]) {
        roleMap[role] = {
          role,
          totalPayout: 0,
          totalBase: 0,
          totalOvertime: 0,
          employeeCount: 0,
        };
      }
      roleMap[role].totalPayout += p.netSalary;
      roleMap[role].totalBase += p.baseSalary;
      roleMap[role].totalOvertime += p.overtimePay;
      roleMap[role].employeeCount++;
    });

    const roleBreakdown = Object.values(roleMap).sort(
      (a, b) => b.totalPayout - a.totalPayout,
    );

    // --- Overtime vs Base Summary ---
    const totalBase = payrolls.reduce((sum, p) => sum + p.baseSalary, 0);
    const totalOvertime = payrolls.reduce((sum, p) => sum + p.overtimePay, 0);
    const totalBonus = payrolls.reduce((sum, p) => sum + p.bonus, 0);
    const totalDeductions = payrolls.reduce(
      (sum, p) => sum + p.deductions + p.leaveDeduction,
      0,
    );
    const totalNet = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

    res.status(200).json({
      summary: {
        totalPayout: totalNet,
        totalBase,
        totalOvertime,
        totalBonus,
        totalDeductions,
        totalRecords: payrolls.length,
        monthsCovered: monthlyTrends.length,
      },
      monthlyTrends,
      roleBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/download-pdf?month=&year=
// Generates and returns a downloadable company-wide PDF summary report
exports.downloadPDFReport = async (req, res, next) => {
  try {
    const userId = req.userId;
    let month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    let year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid month parameter" });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Invalid year parameter" });
    }

    // Fetch payroll records for the selected month
    const payrolls = await PayrollUpdate.find({
      createdBy: userId,
      month,
      year,
    }).sort({ employeeName: 1 });

    if (payrolls.length === 0) {
      return res
        .status(404)
        .json({ message: "No payroll data found for the selected period." });
    }

    // Fetch employee details for roles
    const employeeIds = payrolls.map((p) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    // Get company name from first employee
    const companyName =
      employees.length > 0 ? employees[0].companyName : "PaySphere";

    // Month names for display
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    // Create PDF document
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payroll-report-${monthName}-${year}.pdf`,
    );

    // Pipe the PDF to the response
    doc.pipe(res);

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
      const emp = employeeMap[String(p.employeeId)];
      const role = emp?.role ? ` (${emp.role})` : "";

      // Alternating row background
      if (idx % 2 === 0) {
        doc.rect(startX, rowY - 2, 515, 14).fill("#f9fafb");
      }

      const rowData = [
        `${p.employeeName}${role}`,
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

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: "REPORT_DOWNLOAD",
      resourceType: "Report",
      details: { month, year, type: "payroll-pdf", employeeCount: payrolls.length },
      req,
    });

    logger.info(`PDF report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });

    doc.end();
  } catch (error) {
    next(error);
  }
};
