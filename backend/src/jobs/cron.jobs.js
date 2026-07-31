const cron = require("node-cron");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const { sendPayslipEmail } = require("../services/email.service");
const { sendEmail } = require("../utils/email");
const logger = require("../utils/logger");

// Run on the 1st of every month at 09:00 AM
const startCronJobs = () => {
  cron.schedule("0 9 1 * *", async () => {
    logger.info("Running monthly payslip email job...");
    try {
      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);
      const targetMonth = prevDate.getMonth() + 1;
      const targetYear = prevDate.getFullYear();

      const lockId = `monthly_payslip_${targetYear}_${targetMonth}`;
      
      try {
        // Attempt to acquire lock for this specific month
        await require("../models/cronlock.model").create({
          _id: lockId,
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Cron job lock already acquired by another instance for ${targetMonth}/${targetYear}. Skipping...`);
          return;
        }
        console.error("Error acquiring cron lock:", error);
        return;
      }

      // Find all finalized payrolls for the previous month
      const payrolls = await PayrollUpdate.find({ month: targetMonth, year: targetYear, status: "finalized", payslipEmailed: false });
      
      logger.info(`Found ${payrolls.length} finalized payrolls for ${targetMonth}/${targetYear}`);

      for (const payroll of payrolls) {
        try {
          const employee = await Employee.findById(payroll.employeeId);
          if (employee && employee.email) {
            await sendPayslipEmail(employee, payroll);
            await PayrollUpdate.updateOne({ _id: payroll._id }, { payslipEmailed: true });
          }
        } catch (err) {
          logger.error(`Error sending payslip for payroll ${payroll._id}`, { error: err.message });
        }
      }
      logger.info("Completed monthly payslip email job.");
    } catch (error) {
      logger.error("Cron job error", { error: error.message });
    }
  });
  logger.info("Payslip cron job registered.");

  // Run every day at 08:00 AM for birthdays and anniversaries
  cron.schedule("0 8 * * *", async () => {
    logger.info("Running daily birthday/anniversary email job...");
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentDay = today.getDate();

      const lockId = `daily_greetings_${today.getFullYear()}_${currentMonth}_${currentDay}`;
      try {
        await require("../models/cronlock.model").create({
          _id: lockId,
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Daily greetings lock already acquired for ${currentMonth}/${currentDay}. Skipping...`);
          return;
        }
        console.error("Error acquiring daily greetings lock:", error);
        return;
      }

      const employees = await Employee.find({
        isActive: true,
        email: { $exists: true, $ne: "" }
      });

      let emailsSent = 0;
      for (const emp of employees) {
        // Birthday check
        if (emp.dateOfBirth) {
          const dob = new Date(emp.dateOfBirth);
          if (dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay) {
            await sendEmail({
              to: emp.email,
              subject: `Happy Birthday, ${emp.fullName}!`,
              text: `Dear ${emp.fullName},\n\nWishing you a very Happy Birthday from everyone at ${emp.companyName}!\n\nBest Regards,\nThe Team`
            });
            emailsSent++;
          }
        }

        // Anniversary check
        if (emp.joiningDate) {
          const joinDate = new Date(emp.joiningDate);
          if (joinDate.getMonth() + 1 === currentMonth && joinDate.getDate() === currentDay) {
            const years = today.getFullYear() - joinDate.getFullYear();
            if (years > 0) {
              await sendEmail({
                to: emp.email,
                subject: `Happy ${years} Year Work Anniversary, ${emp.fullName}!`,
                text: `Dear ${emp.fullName},\n\nCongratulations on reaching your ${years} year anniversary at ${emp.companyName}! We appreciate all your hard work.\n\nBest Regards,\nThe Team`
              });
              emailsSent++;
            }
          }
        }
      }
      logger.info(`Completed daily greetings job. Sent ${emailsSent} emails.`);
    } catch (error) {
      logger.error("Daily greetings cron job error", { error: error.message });
    }
  });
  logger.info("Daily greetings cron job registered.");
};

module.exports = { startCronJobs };
