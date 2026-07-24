require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { startCronJobs } = require("./jobs/cron.jobs");
const logger = require("./utils/logger");

const startServer = async () => {
  await connectDB();
  
  // Start background jobs
  startCronJobs();
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
};

startServer();
