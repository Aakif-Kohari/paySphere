const fs = require('fs');
const path = require('path');

// 1. Backend: payroll.controller.js
const payrollCtrlPath = 'src/controllers/payroll.controller.js';
let ctrlCode = fs.readFileSync(payrollCtrlPath, 'utf8');

const parseCsvFunc = `
exports.parsePayrollCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No CSV file uploaded." });
    }
    
    const csvData = req.file.buffer.toString("utf8");
    const lines = csvData.split("\\n");
    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV file is empty or missing headers." });
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    const empIdIdx = headers.findIndex(h => h.includes("employee id") || h === "id");
    const nameIdx = headers.findIndex(h => h.includes("name") || h === "employee name");
    const otIdx = headers.findIndex(h => h.includes("overtime"));
    const bonusIdx = headers.findIndex(h => h.includes("bonus"));
    const leaveIdx = headers.findIndex(h => h.includes("leave"));

    const employees = await Employee.find({ createdBy: req.userId });
    const activities = [];
    const v4 = require('uuid').v4 || (() => Math.random().toString(36).substring(7));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Basic CSV split, ignores quotes (assuming simple format for ECSoC)
      const cols = line.split(",").map(c => c.trim());
      
      const empIdStr = empIdIdx >= 0 ? cols[empIdIdx] : null;
      const nameStr = nameIdx >= 0 ? cols[nameIdx] : null;
      
      let matchedEmp = null;
      if (empIdStr) {
        matchedEmp = employees.find(e => String(e._id) === empIdStr);
      }
      if (!matchedEmp && nameStr) {
        matchedEmp = employees.find(e => e.fullName.toLowerCase() === nameStr.toLowerCase());
      }
      
      if (!matchedEmp) continue; // Skip unmatchable employees

      const tags = [];
      if (otIdx >= 0 && cols[otIdx] && Number(cols[otIdx]) > 0) {
        tags.push({ label: \`+ \${cols[otIdx]} hr overtime\`, bg: "#EFF6FF", color: "#2563EB" });
      }
      if (bonusIdx >= 0 && cols[bonusIdx] && Number(cols[bonusIdx]) > 0) {
        tags.push({ label: \`+ ₹\${cols[bonusIdx]} bonus\`, bg: "#F0FDF4", color: "#16A34A" });
      }
      if (leaveIdx >= 0 && cols[leaveIdx] && Number(cols[leaveIdx]) > 0) {
        const val = Number(cols[leaveIdx]);
        tags.push({ label: \`– \${val} day\${val > 1 ? "s" : ""} leave\`, bg: "#FEF2F2", color: "#DC2626" });
      }

      if (tags.length > 0) {
        activities.push({
          id: v4(),
          employeeId: matchedEmp._id,
          name: matchedEmp.fullName,
          tags,
          note: "Imported via CSV",
          pending: true,
          rawInput: line
        });
      }
    }

    res.status(200).json({ 
      message: "CSV parsed successfully", 
      activities 
    });
  } catch (error) {
    next(error);
  }
};
`;

ctrlCode = ctrlCode.replace(/exports\.finalizePayroll = async/, parseCsvFunc + '\nexports.finalizePayroll = async');
fs.writeFileSync(payrollCtrlPath, ctrlCode);


// 2. Backend: payroll.routes.js
const payrollRoutesPath = 'src/routes/payroll.routes.js';
let routeCode = fs.readFileSync(payrollRoutesPath, 'utf8');

if (!routeCode.includes('parsePayrollCSV')) {
  routeCode = routeCode.replace(
    /const \{([\s\S]*?)finalizePayroll,/, 
    `const { $1finalizePayroll, parsePayrollCSV,`
  );
  
  routeCode = routeCode.replace(
    /const \{ requirePermission \} = require\("\.\.\/middlewares\/rbac\.middleware"\);/,
    `const { requirePermission } = require("../middlewares/rbac.middleware");\nconst upload = require("../middlewares/upload.middleware");`
  );

  routeCode = routeCode.replace(
    /router\.post\("\/finalize",/,
    `router.post("/parse-csv", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, upload.single("file"), parsePayrollCSV);\nrouter.post("/finalize",`
  );
  fs.writeFileSync(payrollRoutesPath, routeCode);
}


// 3. Frontend: MonthlyUpdates.jsx
const frontendPath = '../frontend/src/pages/MonthlyUpdates.jsx';
let feCode = fs.readFileSync(frontendPath, 'utf8');

// Add file reference hook
feCode = feCode.replace(
  /const \[finalizeError, setFinalizeError\] = useState\(""\);/,
  `const [finalizeError, setFinalizeError] = useState("");\n  const fileInputRef = React.useRef(null);`
);
feCode = feCode.replace(/import \{ useState, useEffect \} from "react";/, `import React, { useState, useEffect } from "react";`);

const uploadFunc = `
  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      setFinalizing(true);
      const res = await api.post("/api/payroll/parse-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setActivity(prev => [...prev, ...res.data.activities]);
      setSnackbar({ open: true, message: "CSV data imported successfully", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || "Failed to import CSV", severity: "error" });
    } finally {
      setFinalizing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
`;

feCode = feCode.replace(/const handleApplyCalendar = \(selectedTags\) => \{/, uploadFunc + '\n  const handleApplyCalendar = (selectedTags) => {');

// Add Button
const buttonHtml = `
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "8px 16px", borderRadius: "8px", border: isDark ? "1px solid #334155" : "1px solid #E5E7EB", background: isDark ? "#1e293b" : "white", color: isDark ? "#cbd5e1" : "#374151", fontSize: "14px", fontWeight: 600, cursor: "pointer", marginLeft: "12px" }}
            >
              Import Adjustments
            </button>
            <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" style={{ display: "none" }} />
`;

feCode = feCode.replace(
  /<button\s*onClick=\{handleFinalize\}\s*disabled=\{activity\.length === 0 || finalizing\}/,
  buttonHtml + '\n            <button onClick={handleFinalize} disabled={activity.length === 0 || finalizing}'
);

fs.writeFileSync(frontendPath, feCode);
console.log("Issue 388 applied");
