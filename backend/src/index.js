require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { startCronJobs } = require("./jobs/cron.jobs");
require("./jobs/reportCron"); // Load report scheduling cron job
const { seedRbac } = require("./seeds/rbac.seed");
const { backfillAccountType } = require("./migrations/backfillAccountType");
const { backfillPayrollStatus } = require("./migrations/backfillPayrollStatus");
const {
  backfillSalaryStructures,
} = require("./migrations/backfillSalaryStructures");
const { backfillTenants } = require("./migrations/backfillTenants");
const logger = require("./utils/logger");

const startServer = async () => {
  await connectDB();

  // Separate the account type from the RBAC role reference on accounts written
  // while both shared the name `role`, and stamp `accountType` on the rest.
  // Runs *before* the seeder: it unsets `role` on accounts that never had a
  // real one, which is exactly what the seeder's own backfill then fills in.
  // Idempotent and never throws — see migrations/backfillAccountType.js (#558).
  await backfillAccountType();

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

  // Create one tenant per existing company and stamp `tenantId` onto the
  // accounts and business rows that predate #585, deriving ownership from
  // `createdBy`. Runs last of the migrations because it reads the account
  // shapes the earlier ones normalise. Idempotent, a no-op on an already-scoped
  // database, and never throws — see migrations/backfillTenants.js (#612).
  await backfillTenants();

  // Start background jobs
  startCronJobs();
  
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  require("./sockets/payroll.socket").init(server);
};

startServer();
