const PDFDocument = require("pdfkit");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const eventBus = require("../services/event.service");
const cacheService = require("../services/cache.service");

// GET /api/reports/analytics
// Returns aggregated financial stats for the authenticated user's company
exports.getAnalytics = async (req, res, next) => {
  try {
    const userId = req.userId;
    const monthsBack = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 12);
    const cacheKey = `analytics:${userId}:${monthsBack}`;

    // 1. Check cache first
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

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

    const responseData = {
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
    };

    // 2. Store in cache for 1 hour (3600 seconds)
    await cacheService.setEx(cacheKey, 3600, responseData);

    res.status(200).json(responseData);
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

    // --- Summary Section ---
    const totalPayout = payrolls.reduce((sum, p) => sum + p.netSalary, 0);
    const totalBase = payrolls.reduce((sum, p) => sum + p.baseSalary, 0);
    const totalOvertime = payrolls.reduce((sum, p) => sum + p.overtimePay, 0);
    const totalBonus = payrolls.reduce((sum, p) => sum + p.bonus, 0);
    const totalDeductions = payrolls.reduce(
      (sum, p) => sum + p.deductions + p.leaveDeduction,
      0,
    );

    const { Worker } = require("worker_threads");
    const path = require("path");

    const pdfWorker = new Worker(path.join(__dirname, "../workers/pdf.worker.js"));
    
    let isHandled = false;
    const workerTimeout = setTimeout(() => {
      if (!isHandled) {
        isHandled = true;
        pdfWorker.terminate();
        next(new Error("PDF generation timed out after 30 seconds."));
      }
    }, 30000);

    pdfWorker.postMessage({
      type: "GENERATE_COMPANY_REPORT",
      payload: {
        payrolls,
        employeeMap,
        companyName,
      companyLogoData,
        monthName,
        year,
        totalBase,
        totalOvertime,
        totalBonus,
        totalDeductions,
        totalPayout
      }
    });

    pdfWorker.on("message", async (result) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(workerTimeout);

      if (result.success) {
        // Set response headers for PDF download
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=payroll-report-${monthName}-${year}.pdf`,
        );
        res.send(Buffer.from(result.pdfData));

        eventBus.emit("AUDIT_LOG", {
          userId: req.userId,
          action: "REPORT_DOWNLOAD",
          resourceType: "Report",
          details: { month, year, type: "payroll-pdf", employeeCount: payrolls.length },
          req,
        });
    
        logger.info(`PDF report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });
      } else {
        next(new Error("Failed to generate PDF: " + result.error));
      }
      pdfWorker.terminate();
    });

    pdfWorker.on("error", (err) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(workerTimeout);

      next(err);
      pdfWorker.terminate();
    });

    pdfWorker.on("exit", (code) => {
      if (isHandled) return;
      isHandled = true;
      clearTimeout(workerTimeout);

      if (code !== 0) {
        next(new Error(`PDF Worker stopped with exit code ${code}`));
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Generate a single payslip PDF buffer for zip bundle
const generatePayslipBuffer = (employee, payroll) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    doc.fontSize(20).font("Helvetica-Bold").fillColor("#1e3a5f").text("PaySphere", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).font("Helvetica").fillColor("#555555").text(`Payslip for ${payroll.month}/${payroll.year}`, { align: "center" });
    doc.moveDown(1.5);

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Employee Details");
    doc.fontSize(10).font("Helvetica").fillColor("#555555");
    doc.text(`Employee Name: ${employee.fullName || payroll.employeeName}`);
    doc.text(`Role: ${employee.role || "N/A"}`);
    doc.text(`Company: ${employee.companyName || "PaySphere"}`);
    doc.moveDown(1);

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Earnings & Deductions");
    doc.fontSize(10).font("Helvetica").fillColor("#555555");
    doc.text(`Base Salary: Rs. ${(payroll.baseSalary || 0).toFixed(2)}`);
    doc.text(`Leave Days: ${payroll.leaveDays || 0} (Rs. -${(payroll.leaveDeduction || 0).toFixed(2)})`);
    doc.text(`Overtime Hours: ${payroll.overtimeHours || 0} (Rs. +${(payroll.overtimePay || 0).toFixed(2)})`);
    doc.text(`Bonus: Rs. +${(payroll.bonus || 0).toFixed(2)}`);
    doc.text(`Deductions: Rs. -${(payroll.deductions || 0).toFixed(2)}`);
    doc.moveDown(1);

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e3a5f").text(`Net Salary: Rs. ${(payroll.netSalary || 0).toFixed(2)}`, { underline: true });

    // Bank Details section (if available)
    const bd = employee.bankDetails;
    if (bd && (bd.bankName || bd.accountNumber || bd.routingCode)) {
      doc.moveDown(1.5);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Bank Details");
      doc.fontSize(10).font("Helvetica").fillColor("#555555");
      if (bd.bankName) doc.text(`Bank Name: ${bd.bankName}`);
      if (bd.accountNumber) doc.text(`Account Number: ${bd.accountNumber}`);
      if (bd.routingCode) doc.text(`Routing / IFSC Code: ${bd.routingCode}`);
    }

    doc.end();
  });
};

// GET /api/reports/export-xlsx?month=&year=
// Generates and downloads an Excel spreadsheet containing payroll summary
exports.exportExcelReport = async (req, res, next) => {
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

    const employeeIds = payrolls.map((p) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PaySphere";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`Payroll Summary ${monthName} ${year}`);

    worksheet.columns = [
      { header: "Employee Name", key: "employeeName", width: 25 },
      { header: "Role / Department", key: "role", width: 20 },
      { header: "Base Salary (Rs.)", key: "baseSalary", width: 16 },
      { header: "Leave Days", key: "leaveDays", width: 12 },
      { header: "Leave Deduction (Rs.)", key: "leaveDeduction", width: 20 },
      { header: "Overtime Hours", key: "overtimeHours", width: 15 },
      { header: "Overtime Pay (Rs.)", key: "overtimePay", width: 18 },
      { header: "Bonus (Rs.)", key: "bonus", width: 14 },
      { header: "Deductions (Rs.)", key: "deductions", width: 16 },
      { header: "Net Payout (Rs.)", key: "netSalary", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1E3A5F" },
    };

    let totalBase = 0;
    let totalLeaveDed = 0;
    let totalOvertimePay = 0;
    let totalBonus = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    payrolls.forEach((p) => {
      const emp = employeeMap[String(p.employeeId)];
      const totalDed = (p.deductions || 0) + (p.leaveDeduction || 0);

      totalBase += p.baseSalary || 0;
      totalLeaveDed += p.leaveDeduction || 0;
      totalOvertimePay += p.overtimePay || 0;
      totalBonus += p.bonus || 0;
      totalDeductions += totalDed;
      totalNet += p.netSalary || 0;

      worksheet.addRow({
        employeeName: p.employeeName,
        role: emp?.role || "N/A",
        baseSalary: p.baseSalary,
        leaveDays: p.leaveDays || 0,
        leaveDeduction: p.leaveDeduction || 0,
        overtimeHours: p.overtimeHours || 0,
        overtimePay: p.overtimePay || 0,
        bonus: p.bonus || 0,
        deductions: totalDed,
        netSalary: p.netSalary,
        status: p.status || "finalized",
      });
    });

    const summaryRow = worksheet.addRow({
      employeeName: "TOTAL",
      role: "",
      baseSalary: totalBase,
      leaveDays: "",
      leaveDeduction: totalLeaveDed,
      overtimeHours: "",
      overtimePay: totalOvertimePay,
      bonus: totalBonus,
      deductions: totalDeductions,
      netSalary: totalNet,
      status: "",
    });
    summaryRow.font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payroll-summary-${monthName}-${year}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: "REPORT_DOWNLOAD",
      resourceType: "Report",
      details: { month, year, type: "payroll-xlsx", employeeCount: payrolls.length },
      req,
    });

    logger.info(`XLSX report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/download-zip?month=&year=
// Generates and downloads a ZIP archive containing all employee payslip PDFs
exports.downloadPayslipsZip = async (req, res, next) => {
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

    const employeeIds = payrolls.map((p) => p.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[String(emp._id)] = emp;
    });

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    const archiver = require("archiver");
    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=payslips-${monthName}-${year}.zip`
    );

    archive.pipe(res);

    for (const payroll of payrolls) {
      const emp = employeeMap[String(payroll.employeeId)] || { fullName: payroll.employeeName };
      const pdfBuffer = await generatePayslipBuffer(emp, payroll);
      const safeName = (payroll.employeeName || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
      archive.append(pdfBuffer, { name: `Payslip_${safeName}_${monthName}_${year}.pdf` });
    }

    await archive.finalize();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: "REPORT_DOWNLOAD",
      resourceType: "Report",
      details: { month, year, type: "payslips-zip", employeeCount: payrolls.length },
      req,
    });

    logger.info(`ZIP payslips report downloaded`, { userId: req.userId, month, year, employeeCount: payrolls.length });
  } catch (error) {
    next(error);
  }
};

