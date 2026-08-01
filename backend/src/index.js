require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { startCronJobs } = require("./jobs/cron.jobs");
const { seedRbac } = require("./seeds/rbac.seed");
const { backfillPayrollStatus } = require("./migrations/backfillPayrollStatus");
const {
  backfillSalaryStructures,
} = require("./migrations/backfillSalaryStructures");
const logger = require("./utils/logger");

const startServer = async () => {
  await connectDB();

  // Ensure the RBAC roles/permissions exist and that no account is left without
  // a role. Idempotent, and never throws — see seeds/rbac.seed.js (#413).
  await seedRbac();

  // Normalise the three generations of payroll status strings onto the
  // canonical vocabulary and build the new compound indexes. Idempotent, a
  // no-op on an already-clean collection, and never throws — see
  // migrations/backfillPayrollStatus.js (#458).
  await backfillPayrollStatus();

  // Give every existing employee an `initial` salary revision derived from the
  // figure already on their record, so the history starts from a true
  // statement. Never changes anyone's pay, idempotent, and never throws — see
  // migrations/backfillSalaryStructures.js (#461).
  await backfillSalaryStructures();

  // Start background jobs
  startCronJobs();
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
};

startServer();
