const fs = require('fs');

// 1. Backend: app.js
const appPath = 'src/app.js';
let appCode = fs.readFileSync(appPath, 'utf8');

if (!appCode.includes("auditRoutes")) {
  appCode = appCode.replace(
    /const reportsRoutes = require\("\.\/routes\/reports\.routes"\);/,
    `const reportsRoutes = require("./routes/reports.routes");\nconst auditRoutes = require("./routes/audit.routes");`
  );
  
  appCode = appCode.replace(
    /app\.use\("\/api\/reports", reportsRoutes\);/,
    `app.use("/api/reports", reportsRoutes);\napp.use("/api/audit-logs", auditRoutes);`
  );
  fs.writeFileSync(appPath, appCode);
  console.log("Updated app.js");
}

// 2. Frontend: Settings.jsx
const settingsPath = '../frontend/src/pages/Settings.jsx';
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

if (!settingsCode.includes("auditLogs")) {
  // Add state for Audit Logs
  settingsCode = settingsCode.replace(
    /const \[showDeleteModal, setShowDeleteModal\] = useState\(false\);/,
    `const [showDeleteModal, setShowDeleteModal] = useState(false);\n  const [auditLogs, setAuditLogs] = useState([]);\n  const [auditPage, setAuditPage] = useState(1);\n  const [auditTotalPages, setAuditTotalPages] = useState(1);`
  );

  // Add fetch effect for Audit Logs
  const fetchAuditEffect = `
  useEffect(() => {
    if (activeTab === "audit") {
      api.get(\`/api/audit-logs?page=\${auditPage}&limit=15\`)
        .then(res => {
          setAuditLogs(res.data.logs);
          setAuditTotalPages(res.data.totalPages);
        })
        .catch(err => console.error("Failed to fetch audit logs", err));
    }
  }, [activeTab, auditPage]);
`;
  settingsCode = settingsCode.replace(/const emailRegex =/, fetchAuditEffect + '\n  const emailRegex =');

  // Add "Audit Trail" to tabs
  settingsCode = settingsCode.replace(
    /\{ id: "notifications", label: "Notifications", icon: BellIcon \}/,
    `{ id: "notifications", label: "Notifications", icon: BellIcon },
    { id: "audit", label: "Audit Trail", icon: InfoIcon }`
  );

  // Add rendering block for "audit" tab
  const auditRender = `
        {activeTab === "audit" && (
          <div className="settings-section">
            <h2 className="section-title">Audit Trail</h2>
            <p className="section-description">View all security and administrative events recorded for your account.</p>
            
            <div style={{ background: isDark ? "#1e293b" : "white", border: isDark ? "1px solid #334155" : "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0f172a" : "#f9fafb", borderBottom: isDark ? "1px solid #334155" : "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px", fontSize: "13px", color: isDark ? "#9ca3af" : "#6b7280" }}>Timestamp</th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", color: isDark ? "#9ca3af" : "#6b7280" }}>Action</th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", color: isDark ? "#9ca3af" : "#6b7280" }}>Resource</th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", color: isDark ? "#9ca3af" : "#6b7280" }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log._id} style={{ borderBottom: isDark ? "1px solid #334155" : "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: isDark ? "#e2e8f0" : "#111827" }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: isDark ? "#e2e8f0" : "#111827", fontWeight: 600 }}>{log.action}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: isDark ? "#9ca3af" : "#6b7280" }}>{log.resourceType}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: isDark ? "#9ca3af" : "#6b7280" }}>{log.ipAddress || "N/A"}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ padding: "24px", textAlign: "center", color: isDark ? "#9ca3af" : "#6b7280" }}>No audit logs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderTop: isDark ? "1px solid #334155" : "1px solid #e5e7eb" }}>
                <button 
                  disabled={auditPage === 1}
                  onClick={() => setAuditPage(p => p - 1)}
                  style={{ padding: "6px 12px", borderRadius: "6px", background: isDark ? "#334155" : "#f1f5f9", color: isDark ? "white" : "#111827", border: "none", cursor: auditPage === 1 ? "not-allowed" : "pointer", opacity: auditPage === 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span style={{ fontSize: "14px", color: isDark ? "#9ca3af" : "#6b7280" }}>Page {auditPage} of {auditTotalPages || 1}</span>
                <button 
                  disabled={auditPage === auditTotalPages || auditTotalPages === 0}
                  onClick={() => setAuditPage(p => p + 1)}
                  style={{ padding: "6px 12px", borderRadius: "6px", background: isDark ? "#334155" : "#f1f5f9", color: isDark ? "white" : "#111827", border: "none", cursor: (auditPage === auditTotalPages || auditTotalPages === 0) ? "not-allowed" : "pointer", opacity: (auditPage === auditTotalPages || auditTotalPages === 0) ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
`;

  settingsCode = settingsCode.replace(/\{\/\* Tab Content \*\/\}/, '{/* Tab Content */}\n' + auditRender);
  fs.writeFileSync(settingsPath, settingsCode);
  console.log("Updated Settings.jsx");
}
