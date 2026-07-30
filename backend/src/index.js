require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { startCronJobs } = require("./jobs/cron.jobs");
const { seedRbac } = require("./seeds/rbac.seed");
const logger = require("./utils/logger");

const startServer = async () => {
  await connectDB();

  // Ensure the RBAC roles/permissions exist and that no account is left without
  // a role. Idempotent, and never throws — see seeds/rbac.seed.js (#413).
  await seedRbac();

  // Start background jobs
  startCronJobs();
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
};

startServer();
