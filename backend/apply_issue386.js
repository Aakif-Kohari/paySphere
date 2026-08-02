const fs = require('fs');

// 2. user.controller.js
const authCtrlPath = 'src/controllers/user.controller.js';
let authCtrlCode = fs.readFileSync(authCtrlPath, 'utf8');
if (!authCtrlCode.includes('uploadLogo')) {
  const uploadLogoFunc = `
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });
    
    // Store as base64 string
    const base64Data = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;
    const logoDataUrl = \`data:\${mimeType};base64,\${base64Data}\`;

    await User.findByIdAndUpdate(req.userId, { companyLogoData: logoDataUrl });
    
    // Also invalidate settings cache if we had one
    res.status(200).json({ message: "Logo updated successfully", logo: logoDataUrl });
  } catch (error) {
    next(error);
  }
};
`;
  authCtrlCode = authCtrlCode.replace(/exports\.updateSettings = async/, uploadLogoFunc + '\nexports.updateSettings = async');
  fs.writeFileSync(authCtrlPath, authCtrlCode);
  console.log("Updated user.controller.js");
}

// 3. user.routes.js
const authRoutesPath = 'src/routes/user.routes.js';
let authRoutesCode = fs.readFileSync(authRoutesPath, 'utf8');
if (!authRoutesCode.includes('uploadLogo')) {
  authRoutesCode = authRoutesCode.replace(
    /const \{([\s\S]*?)updateSettings,/,
    `const { $1updateSettings, uploadLogo,`
  );
  authRoutesCode = authRoutesCode.replace(
    /const auth = require\("\.\.\/middlewares\/auth\.middleware"\);/,
    `const auth = require("../middlewares/auth.middleware");\nconst upload = require("../middlewares/upload.middleware");`
  );
  authRoutesCode = authRoutesCode.replace(
    /router\.put\("\/settings",/,
    `router.post("/settings/logo", auth, upload.single("logo"), uploadLogo);\nrouter.put("/settings",`
  );
  fs.writeFileSync(authRoutesPath, authRoutesCode);
  console.log("Updated user.routes.js");
}

// 4. reports.controller.js
const reportsCtrlPath = 'src/controllers/reports.controller.js';
let reportsCtrlCode = fs.readFileSync(reportsCtrlPath, 'utf8');
if (!reportsCtrlCode.includes('companyLogoData')) {
  reportsCtrlCode = reportsCtrlCode.replace(
    /const companyName = employees\.length > 0 \? employees\[0\]\.companyName : "PaySphere";/,
    `const user = await User.findById(userId);\n    const companyName = user ? user.companyName : (employees.length > 0 ? employees[0].companyName : "PaySphere");\n    const companyLogoData = user ? user.companyLogoData : "";`
  );
  reportsCtrlCode = reportsCtrlCode.replace(
    /companyName,(\s+)monthName,/,
    `companyName,\n      companyLogoData,$1monthName,`
  );
  if (!reportsCtrlCode.includes('const User = require')) {
    reportsCtrlCode = reportsCtrlCode.replace(
      /const Employee = require\("\.\.\/models\/employee\.model"\);/,
      `const Employee = require("../models/employee.model");\nconst User = require("../models/user.model");`
    );
  }
  fs.writeFileSync(reportsCtrlPath, reportsCtrlCode);
  console.log("Updated reports.controller.js");
}

// 5. pdf.worker.js
const pdfWorkerPath = 'src/workers/pdf.worker.js';
let pdfWorkerCode = fs.readFileSync(pdfWorkerPath, 'utf8');
if (!pdfWorkerCode.includes('companyLogoData')) {
  pdfWorkerCode = pdfWorkerCode.replace(
    /const \{ payrolls, companyName, monthName, year \} = workerData;/,
    `const { payrolls, companyName, companyLogoData, monthName, year } = workerData;`
  );
  
  const logoDrawingLogic = `
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
`;
  pdfWorkerCode = pdfWorkerCode.replace(
    /\/\/ --- Company Header ---/,
    logoDrawingLogic + '\n    // --- Company Header ---'
  );
  fs.writeFileSync(pdfWorkerPath, pdfWorkerCode);
  console.log("Updated pdf.worker.js");
}

// 6. Settings.jsx
const settingsPath = '../frontend/src/pages/Settings.jsx';
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

if (!settingsCode.includes("companyLogoUrl")) {
  settingsCode = settingsCode.replace(
    /companyName: localCompanyName,/,
    `companyName: localCompanyName,\n    companyLogoUrl: "",`
  );

  settingsCode = settingsCode.replace(
    /companyName: res\.data\.companyName \|\| localCompanyName,/,
    `companyName: res.data.companyName || localCompanyName,\n          companyLogoUrl: res.data.companyLogoData || "",`
  );
  
  const uploadLogoUiLogic = `
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("logo", file);
    try {
      // It is in user routes, which is mounted at /api/users
      const res = await api.post("/api/users/settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUserProfile(prev => ({ ...prev, companyLogoUrl: res.data.logo }));
      alert("Logo uploaded successfully");
    } catch (err) {
      alert("Failed to upload logo");
    }
  };
`;

  settingsCode = settingsCode.replace(/const handleSaveSettings = async/, uploadLogoUiLogic + '\n  const handleSaveSettings = async');

  const logoUi = `
                <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: 80, height: 80, borderRadius: "12px", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: isDark ? "#1e293b" : "#f8fafc" }}>
                    {userProfile.companyLogoUrl ? (
                      <img src={userProfile.companyLogoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>No Logo</span>
                    )}
                  </div>
                  <div>
                    <input type="file" id="logoUpload" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
                    <label htmlFor="logoUpload" style={{ padding: "8px 16px", borderRadius: "8px", background: "#3b82f6", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Upload Logo</label>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>PNG or JPG. Will appear on payslips.</p>
                  </div>
                </div>
`;
  settingsCode = settingsCode.replace(
    /<div className="form-group">\s*<label className="form-label">Company Name<\/label>/,
    logoUi + '\n                <div className="form-group">\n                  <label className="form-label">Company Name</label>'
  );

  fs.writeFileSync(settingsPath, settingsCode);
  console.log("Updated Settings.jsx");
}
