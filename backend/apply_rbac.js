const fs = require('fs');
const path = require('path');

// 1. user.model.js
const userModelPath = 'src/models/user.model.js';
let userCode = fs.readFileSync(userModelPath, 'utf8');

// Insert role field after companyName
const roleField = `
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role"
  },`;

userCode = userCode.replace(
  /companyName: \{\s*type: String,\s*required: true,\s*\},/,
  `companyName: {\n    type: String,\n    required: true,\n  },${roleField}`
);
fs.writeFileSync(userModelPath, userCode);
console.log("Updated user.model.js");

// 2. employee.routes.js
const empRoutesPath = 'src/routes/employee.routes.js';
let empCode = fs.readFileSync(empRoutesPath, 'utf8');

// Add import
empCode = empCode.replace(
  /const auth = require\("\.\.\/middlewares\/auth\.middleware"\);/,
  `const auth = require("../middlewares/auth.middleware");\nconst { requirePermission } = require("../middlewares/rbac.middleware");`
);

// Add permissions to routes
empCode = empCode.replace(/router\.post\("\/", auth, writeRateLimiter, addEmployee\);/, `router.post("/", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, addEmployee);`);
empCode = empCode.replace(/router\.post\("\/import", auth, writeRateLimiter, upload\.single\("file"\), importEmployees\);/, `router.post("/import", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, upload.single("file"), importEmployees);`);
empCode = empCode.replace(/router\.get\("\/", auth, getEmployees\);/, `router.get("/", auth, requirePermission("READ_EMPLOYEE"), getEmployees);`);
empCode = empCode.replace(/router\.get\("\/recent", auth, getRecentEmployees\);/, `router.get("/recent", auth, requirePermission("READ_EMPLOYEE"), getRecentEmployees);`);
empCode = empCode.replace(/router\.delete\("\/:id", auth, writeRateLimiter, deleteEmployee\);/, `router.delete("/:id", auth, requirePermission("DELETE_EMPLOYEE"), writeRateLimiter, deleteEmployee);`);
empCode = empCode.replace(/router\.put\("\/:id", auth, writeRateLimiter, updateEmployee\);/, `router.put("/:id", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, updateEmployee);`);
empCode = empCode.replace(/router\.patch\("\/:id\/status", auth, writeRateLimiter, toggleEmployeeStatus\);/, `router.patch("/:id/status", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, toggleEmployeeStatus);`);

fs.writeFileSync(empRoutesPath, empCode);
console.log("Updated employee.routes.js");

// 3. payroll.routes.js
const payrollRoutesPath = 'src/routes/payroll.routes.js';
let payrollCode = fs.readFileSync(payrollRoutesPath, 'utf8');

// Add import
payrollCode = payrollCode.replace(
  /const auth = require\("\.\.\/middlewares\/auth\.middleware"\);/,
  `const auth = require("../middlewares/auth.middleware");\nconst { requirePermission } = require("../middlewares/rbac.middleware");`
);

// Add permissions to routes
payrollCode = payrollCode.replace(/router\.post\("\/finalize", auth, writeRateLimiter, finalizePayroll\);/, `router.post("/finalize", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, finalizePayroll);`);
payrollCode = payrollCode.replace(/router\.get\("\/summary", auth, getPayrollSummary\);/, `router.get("/summary", auth, requirePermission("READ_PAYROLL"), getPayrollSummary);`);
payrollCode = payrollCode.replace(/router\.get\("\/export-csv", auth, exportPayrollCSV\);/, `router.get("/export-csv", auth, requirePermission("READ_REPORT"), exportPayrollCSV);`);
payrollCode = payrollCode.replace(/router\.post\("\/send-email\/:id", auth, writeRateLimiter, sendPayslipEmailHandler\);/, `router.post("/send-email/:id", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, sendPayslipEmailHandler);`);
payrollCode = payrollCode.replace(/router\.post\("\/send-all-emails", auth, writeRateLimiter, sendAllPayslipsEmailHandler\);/, `router.post("/send-all-emails", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, sendAllPayslipsEmailHandler);`);

fs.writeFileSync(payrollRoutesPath, payrollCode);
console.log("Updated payroll.routes.js");

// 4. reports.routes.js
const reportRoutesPath = 'src/routes/reports.routes.js';
let reportCode = fs.readFileSync(reportRoutesPath, 'utf8');

// Add import
reportCode = reportCode.replace(
  /const auth = require\("\.\.\/middlewares\/auth\.middleware"\);/,
  `const auth = require("../middlewares/auth.middleware");\nconst { requirePermission } = require("../middlewares/rbac.middleware");`
);

// Add permissions to routes
reportCode = reportCode.replace(/router\.get\("\/analytics", auth, getAnalytics\);/, `router.get("/analytics", auth, requirePermission("READ_REPORT"), getAnalytics);`);
reportCode = reportCode.replace(/router\.get\("\/download-pdf", auth, downloadPDFReport\);/, `router.get("/download-pdf", auth, requirePermission("READ_REPORT"), downloadPDFReport);`);

fs.writeFileSync(reportRoutesPath, reportCode);
console.log("Updated reports.routes.js");
