const cron = require("node-cron");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const { sendPayslipEmail } = require("../services/email.service");
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

      // Find all finalized payrolls for the previous month
      const payrolls = await PayrollUpdate.find({ month: targetMonth, year: targetYear, status: "finalized" });
      
      logger.info(`Found ${payrolls.length} finalized payrolls for ${targetMonth}/${targetYear}`);

      for (const payroll of payrolls) {
        try {
          const employee = await Employee.findById(payroll.employeeId);
          if (employee && employee.email) {
            await sendPayslipEmail(employee, payroll);
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
};

module.exports = { startCronJobs };
