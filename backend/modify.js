const fs = require('fs');
let code = fs.readFileSync('src/controllers/employee.controller.js', 'utf8');

code = code.replace(
    /const \{ createAuditLog \} = require\("\.\.\/services\/audit\.service"\);/,
    `const { createAuditLog } = require("../services/audit.service");\nconst cacheService = require("../services/cache.service");`
);

code = code.replace(
    /res\.status\(201\)\.json\(\{ message: "Employee added successfully", employee \}\);/g,
    `await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);\n    res.status(201).json({ message: "Employee added successfully", employee });`
);

code = code.replace(
    /res\.status\(200\)\.json\(\{ message: "Employee updated successfully", employee \}\);/g,
    `await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);\n    res.status(200).json({ message: "Employee updated successfully", employee });`
);

code = code.replace(
    /res\.status\(200\)\.json\(\{ message: "Employee deleted successfully" \}\);/g,
    `await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);\n    res.status(200).json({ message: "Employee deleted successfully" });`
);

code = code.replace(
    /res\.status\(200\)\.json\(\{ message: `Employee status updated to \$\{employee\.isActive \? 'Active' : 'Inactive'\}` \}\);/g,
    `await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);\n    res.status(200).json({ message: \`Employee status updated to \${employee.isActive ? 'Active' : 'Inactive'}\` });`
);

code = code.replace(
    /res\.status\(200\)\.json\(\{\n\s+message: "Employees imported successfully",/g,
    `await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);\n    res.status(200).json({\n      message: "Employees imported successfully",`
);

fs.writeFileSync('src/controllers/employee.controller.js', code);
console.log("employee.controller.js modified successfully");

// Now let's do payroll.controller.js
let payrollCode = fs.readFileSync('src/controllers/payroll.controller.js', 'utf8');
payrollCode = payrollCode.replace(
    /const \{ createAuditLog \} = require\("\.\.\/services\/audit\.service"\);/,
    `const { createAuditLog } = require("../services/audit.service");\nconst cacheService = require("../services/cache.service");`
);

payrollCode = payrollCode.replace(
    /res\.status\(200\)\.json\(\{ message: "Payroll finalized successfully"/g,
    `await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);\n    res.status(200).json({ message: "Payroll finalized successfully"`
);

fs.writeFileSync('src/controllers/payroll.controller.js', payrollCode);
console.log("payroll.controller.js modified successfully");
