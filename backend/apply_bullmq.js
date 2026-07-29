const fs = require('fs');

// 1. payroll.controller.js
const controllerPath = 'src/controllers/payroll.controller.js';
let code = fs.readFileSync(controllerPath, 'utf8');

const importStr = `const { payrollQueue } = require("../jobs/queue.service");\n`;
code = code.replace(/const \{ calculateNetSalary \} = require\("\.\.\/utils\/salaryCalculator"\);/, importStr + `const { calculateNetSalary } = require("../utils/salaryCalculator");`);

// Replace finalizePayroll body
const newFinalizePayroll = `
exports.finalizePayroll = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ message: "Request body is required" });
    }
    const { activities, month, year } = req.body;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: "No activities to process" });
    }

    let currentMonth = month !== undefined ? Number(month) : new Date().getMonth() + 1;
    let currentYear = year !== undefined ? Number(year) : new Date().getFullYear();

    // Dispatch to BullMQ
    const job = await payrollQueue.add("process-payroll", {
      activities,
      currentMonth,
      currentYear,
      userId: req.userId
    });
    
    // Invalidate cache immediately so new queries might see pending state if we had one
    try {
      const cacheService = require("../services/cache.service");
      await cacheService.invalidatePattern(\`analytics:\${req.userId}\`);
    } catch(e) {} // ignore if cacheService isn't there yet in this branch
    
    createAuditLog({
      userId: req.userId,
      action: "PAYROLL_JOB_QUEUED",
      resourceType: "Job",
      details: { jobId: job.id, month: currentMonth, year: currentYear },
      req,
    });

    res.status(202).json({ 
      message: "Payroll processing queued successfully", 
      jobId: job.id 
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayrollStatus = async (req, res, next) => {
  try {
    const job = await payrollQueue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    const state = await job.getState();
    const progress = job.progress;
    
    res.status(200).json({ state, progress });
  } catch (error) {
    next(error);
  }
};
`;

// Replace from exports.finalizePayroll to the end of the try catch (it's huge)
code = code.replace(/exports\.finalizePayroll = async \(req, res, next\) => \{[\s\S]*?res\.status\(200\)\.json\(\{ message: "Payroll finalized successfully", processedCount: savedRecords\.length \}\);\n\s*\} catch \(error\) \{\n\s*if \(session\) \{\n\s*await session\.abortTransaction\(\);\n\s*session\.endSession\(\);\n\s*\}\n\s*next\(error\);\n\s*\}\n\};/, newFinalizePayroll);

fs.writeFileSync(controllerPath, code);

// 2. payroll.routes.js
const routesPath = 'src/routes/payroll.routes.js';
let routeCode = fs.readFileSync(routesPath, 'utf8');

routeCode = routeCode.replace(
  /finalizePayroll,/,
  `finalizePayroll, getPayrollStatus,`
);

routeCode = routeCode.replace(
  /router\.post\("\/finalize",/,
  `router.get("/status/:jobId", auth, getPayrollStatus);\nrouter.post("/finalize",`
);

fs.writeFileSync(routesPath, routeCode);

console.log("BullMQ applied successfully");
