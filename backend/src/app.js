const express = require("express");
const dashboardRoutes = require('./routes/dashboard.routes')
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const userRoutes = require("./routes/user.routes");
const employeeRoutes = require("./routes/employee.routes");
const payrollRoutes = require("./routes/payroll.routes");
const reportsRoutes = require("./routes/reports.routes");
const auditRoutes = require("./routes/audit.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const settlementRoutes = require("./routes/settlement.routes");
const loanRoutes = require("./routes/loan.routes");
const schedulerRoutes = require("./routes/scheduler.routes");
const employeePortalRoutes = require("./routes/employeePortal.routes");
const workflowRoutes = require("./routes/workflow.routes");
const salaryHistoryRoutes = require("./routes/salaryHistory.routes");
const logger = require("./utils/logger");
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();
app.use('/api/dashboard', dashboardRoutes)
app.use(cookieParser());

const errorHandler = require("./middlewares/error.middleware");

// Security headers
app.use(helmet({ crossOriginOpenerPolicy: false }));

// Rate limiting trust proxy configuration
app.set("trust proxy", 1);

// HTTP request logging via morgan + winston
app.use(morgan("combined", { stream: logger.stream }));

// CORS configuration — restrict to frontend origin
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors(corsOptions));

const { generalRateLimiter } = require("./middlewares/rateLimiter.middleware");
const requireBody = require("./middlewares/requireBody.middleware");
const { MAX_FILE_SIZE } = require("./middlewares/upload.middleware");

// Require request body for state-changing methods
app.use("/api", requireBody);

// Routes
app.get("/", (req, res) => res.send("PaySphere API is running..."));
app.use("/api", generalRateLimiter);
app.use("/api/auth", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/employee-portal", employeePortalRoutes);
app.use("/api/schedules", schedulerRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/loans", loanRoutes);
// #590 shipped the controller, the models, the router and a WorkflowBuilder
// page, and never registered the router — so the whole engine was a 404 and the
// builder had nothing to talk to. It could not simply be added either: the
// router destructured a `verifyToken` export that does not exist, so mounting
// it threw at require time and took the process down at boot (#614).
app.use("/api/workflows", workflowRoutes);

app.use('/api', salaryHistoryRoutes);

app.use('/api/dashboard', dashboardRoutes);

// CORS error handler — return 403 for blocked origins
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS not allowed" });
  }
  next(err);
});

// Multer error handler — return 400 for file upload issues
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      return res.status(400).json({ message: `File too large. Maximum size is ${maxMB}MB.` });
    }
    return res.status(400).json({ message: "File upload error" });
  }
  next(err);
});

// Centralized error handler
app.use(errorHandler);


module.exports = app;
