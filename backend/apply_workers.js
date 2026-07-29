const fs = require('fs');

// 1. reports.controller.js
const reportPath = 'src/controllers/reports.controller.js';
let reportCode = fs.readFileSync(reportPath, 'utf8');

reportCode = reportCode.replace(
  /const cacheService = require\("\.\.\/services\/cache\.service"\);/,
  `const cacheService = require("../services/cache.service");\nconst exportService = require("../services/export.service");`
);

// We need to completely replace downloadPDFReport since we moved all pdfkit logic out.
const newDownloadPDF = `
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
    
    // Get company name from first employee
    const companyName = employees.length > 0 ? employees[0].companyName : "PaySphere";

    // Month names for display
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month - 1];

    // Offload PDF generation to worker thread
    const pdfBuffer = await exportService.generatePDF({
      payrolls: payrolls.map(p => p.toObject()), // convert Mongoose doc to plain object for worker
      companyName,
      monthName,
      year
    });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      \`attachment; filename=payroll-report-\${monthName}-\${year}.pdf\`
    );

    res.send(pdfBuffer);

    createAuditLog({
      userId: req.userId,
      action: "REPORT_DOWNLOAD",
      resourceType: "Report",
      details: { month, year, type: "payroll-pdf", employeeCount: payrolls.length },
      req,
    });

    logger.info(\`PDF report downloaded via worker thread\`, { userId: req.userId, month, year });
  } catch (error) {
    next(error);
  }
};
`;

reportCode = reportCode.replace(/exports\.downloadPDFReport = async \(req, res, next\) => \{[\s\S]*?\}\n\s*catch \(error\) \{\n\s*next\(error\);\n\s*\}\n\};/, newDownloadPDF);
fs.writeFileSync(reportPath, reportCode);
console.log("Updated reports.controller.js");

// 2. payroll.controller.js
const payrollPath = 'src/controllers/payroll.controller.js';
let payrollCode = fs.readFileSync(payrollPath, 'utf8');

payrollCode = payrollCode.replace(
  /const \{ generatePayrollCSV \} = require\("\.\.\/utils\/csvExport"\);/,
  `const exportService = require("../services/export.service");`
);

const newExportCSV = `
exports.exportPayrollCSV = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const payrolls = await PayrollUpdate.find({
      createdBy: req.userId,
      month: Number(month),
      year: Number(year),
    }).sort({ employeeName: 1 });

    if (payrolls.length === 0) {
      return res.status(404).json({ message: "No records found for the given month and year" });
    }

    // Offload CSV generation to worker thread
    const csvString = await exportService.generateCSV({
      payrolls: payrolls.map(p => p.toObject())
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      \`attachment; filename=payroll_\${month}_\${year}.csv\`
    );

    res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
};
`;

payrollCode = payrollCode.replace(/exports\.exportPayrollCSV = async \(req, res, next\) => \{[\s\S]*?\}\n\s*catch \(error\) \{\n\s*next\(error\);\n\s*\}\n\};/, newExportCSV);
fs.writeFileSync(payrollPath, payrollCode);
console.log("Updated payroll.controller.js");
