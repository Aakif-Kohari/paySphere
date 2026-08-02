const fs = require('fs');

// 1. Initialize listener in app.js
const appPath = 'src/app.js';
let appCode = fs.readFileSync(appPath, 'utf8');

if (!appCode.includes("require('./listeners/audit.listener')")) {
  appCode = appCode.replace(
    /const cronJobs = require\("\.\/jobs\/cron\.jobs"\);/,
    `const cronJobs = require("./jobs/cron.jobs");\nrequire('./listeners/audit.listener'); // Initialize event listeners`
  );
  fs.writeFileSync(appPath, appCode);
  console.log("Updated app.js");
}

// 2. Refactor controllers
const controllers = [
  'src/controllers/employee.controller.js',
  'src/controllers/payroll.controller.js',
  'src/controllers/user.controller.js',
  'src/controllers/reports.controller.js'
];

for (const ctrlPath of controllers) {
  if (fs.existsSync(ctrlPath)) {
    let code = fs.readFileSync(ctrlPath, 'utf8');
    
    // Replace import
    code = code.replace(
      /const \{ createAuditLog \} = require\("\.\.\/services\/audit\.service"\);/g,
      `const eventBus = require("../services/event.service");`
    );

    // Some places use it directly, so let's also catch the case where it's already there
    // Actually, createAuditLog is called as createAuditLog({ ... })
    // We can replace createAuditLog( with eventBus.emit("AUDIT_LOG", 
    code = code.replace(/createAuditLog\(/g, `eventBus.emit("AUDIT_LOG", `);

    fs.writeFileSync(ctrlPath, code);
    console.log(`Updated ${ctrlPath}`);
  }
}
