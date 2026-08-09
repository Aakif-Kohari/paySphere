const express = require("express");
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
const dashboardRoutes = require("./routes/dashboard.routes");
const flashcardRoutes = require("./routes/flashcard.routes");
const pyqRoutes = require("./routes/pyq.routes");
const logger = require("./utils/logger");

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────
//
// Order matters, and it is the reason #663 existed: a router mounted above this
// block gets none of it. Everything below `app.use('/api', …)` is therefore
// declared after the whole stack, with no exceptions.

app.use(cookieParser());

// CORS configuration — restrict strictly to frontend origin
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, unit tests)
    if (!origin) {
      return callback(null, true);
    }
    if (origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// Security headers (HSTS, Content Security Policy, X-Content-Type-Options: nosniff)
app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", allowedOrigin],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"], // blocks clickjacking
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year HSTS
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: true, // nosniff
  })
);

// Rate limiting trust proxy configuration
app.set("trust proxy", 1);

// HTTP request logging via morgan + winston
app.use(morgan("combined", { stream: logger.stream }));

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cors(corsOptions));

const redactionMiddleware = require("./middlewares/redaction.middleware");
app.use(redactionMiddleware);

const { generalRateLimiter } = require("./middlewares/rateLimiter.middleware");
const requireBody = require("./middlewares/requireBody.middleware");
const { MAX_FILE_SIZE } = require("./middlewares/upload.middleware");

// Require request body for state-changing methods
app.use('/api', requireBody);

// ─── Routes ────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('PaySphere API is running...'));

app.use('/api', generalRateLimiter);
app.use('/api/auth', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/employee-portal', employeePortalRoutes);
app.use('/api/schedules', schedulerRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/loans', loanRoutes);

// The archive browser for soft-deleted employees (#759). Mounted by one of the
// two duplicated route tables and not the other.
app.use('/api/archive', archiveRoutes);

// #590 shipped the controller, the models, the router and a WorkflowBuilder
// page, and never registered the router — so the whole engine was a 404 and the
// builder had nothing to talk to. It could not simply be added either: the
// router destructured a `verifyToken` export that does not exist, so mounting
// it threw at require time and took the process down at boot (#614).
app.use('/api/workflows', workflowRoutes);

app.use('/api', salaryHistoryRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/pyqs", pyqRoutes);

// Mounted here, once (#663).
//
// This router used to be mounted twice: on line 23, immediately after
// `express()` and therefore *above* the cookie parser, Helmet, morgan, CORS,
// the JSON body parser, the rate limiter and `requireBody` — and again down
// here. Express serves the first mount that matches, so the copy that won was
// the one with no middleware in front of it. Dashboard traffic got no security
// headers, no origin check, no rate limit and no access log, and
// `POST /api/dashboard/layout` threw a TypeError destructuring an unparsed
// `req.body` on every call.
app.use('/api/dashboard', dashboardRoutes);

// The in-app notification centre (#440). The other half of the duplicate.
app.use('/api/notifications', notificationRoutes);

// Monthly activity updates (#509). Router and controller both written, never
// mounted by either copy of the route table — the same omission as #614 and
// #474, found while reconciling the two.
app.use('/api/monthly-updates', monthlyUpdatesRoutes);

// Expense claims (#719). Also never mounted by either copy. The endpoints
// answer 403 until the EXPENSE permissions exist (#794); mounting them is the
// part that belongs to this file.
app.use('/api/expenses', expenseRoutes);

// Full-text search via Elasticsearch (#771). Returns ranked results across
// employees, payroll, and audit-log indices without exposing raw Mongo regex.
app.use('/api/search', searchRoutes);

// ─── Error handlers ────────────────────────────────────────────────────────

// CORS error handler — return 403 for blocked origins
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS not allowed' });
  }
  next(err);
});

// Multer error handler — return 400 for file upload issues
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      return res
        .status(400)
        .json({ message: `File too large. Maximum size is ${maxMB}MB.` });
    }
    return res.status(400).json({ message: 'File upload error' });
  }
  next(err);
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
