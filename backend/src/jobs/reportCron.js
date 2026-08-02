const cron = require("node-cron");
const ReportSchedule = require("../models/reportSchedule.model");
const logger = require("../utils/logger");
// We mock nodemailer/sendEmail logic for this demonstration since actual SMTP isn't configured
// In a real application, you would use nodemailer or SendGrid to dispatch emails.

const runScheduledReports = async () => {
  logger.info("Cron: Checking for scheduled reports to execute.");
  try {
    const schedules = await ReportSchedule.find({ isActive: true });
    const now = new Date();
    
    for (const schedule of schedules) {
      let shouldRun = false;

      // Simple scheduling logic based on frequency and lastRunAt
      if (!schedule.lastRunAt) {
        shouldRun = true;
      } else {
        const diffMs = now - new Date(schedule.lastRunAt);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        if (schedule.frequency === "daily" && diffDays >= 1) shouldRun = true;
        if (schedule.frequency === "weekly" && diffDays >= 7) shouldRun = true;
        if (schedule.frequency === "monthly" && diffDays >= 30) shouldRun = true;
      }

      if (shouldRun) {
        logger.info(`Cron: Running scheduled ${schedule.reportType} report for user ${schedule.createdBy} (Schedule ID: ${schedule._id})`);
        
        // --- Mocking the actual report generation and email dispatch ---
        // 1. Determine date range
        // 2. Query database or invoke the relevant controller logic
        // 3. Generate PDF/CSV buffer
        // 4. Send email to schedule.recipients
        logger.info(`Cron: Simulated sending email to ${schedule.recipients.join(', ')} for ${schedule.reportType} report`);

        schedule.lastRunAt = now;
        await schedule.save();
      }
    }
  } catch (error) {
    logger.error("Error running scheduled reports", error);
  }
};

// Schedule the task to run daily at midnight
cron.schedule("0 0 * * *", runScheduledReports);

module.exports = { runScheduledReports };
