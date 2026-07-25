const cron = require("node-cron");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const { sendPayslipEmail } = require("../services/email.service");

// Run on the 1st of every month at 09:00 AM
const startCronJobs = () => {
  cron.schedule("0 9 1 * *", async () => {
    console.log("Running monthly payslip email job...");
    try {
      const prevDate = new Date();
      prevDate.setMonth(prevDate.getMonth() - 1);
      const targetMonth = prevDate.getMonth() + 1;
      const targetYear = prevDate.getFullYear();

      const lockId = `monthly_payslip_${targetYear}_${targetMonth}`;
      
      // Attempt to acquire lock for this specific month
      const lock = await require("../models/cronlock.model").findOneAndUpdate(
        { _id: lockId },
        { 
          $setOnInsert: { 
            _id: lockId, 
            lockedAt: new Date(), 
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          } 
        },
        { upsert: true, new: true, returnDocument: "after" }
      );

      // If lockedAt is NOT within the last few seconds, it means another instance created it
      if (Date.now() - lock.lockedAt.getTime() > 10000) {
        console.log(`Cron job lock already acquired by another instance for ${targetMonth}/${targetYear}. Skipping...`);
        return;
      }

      // Find all finalized payrolls for the previous month
      const payrolls = await PayrollUpdate.find({ month: targetMonth, year: targetYear, status: "finalized" });
      
      console.log(`Found ${payrolls.length} finalized payrolls for ${targetMonth}/${targetYear}`);

      for (const payroll of payrolls) {
        try {
          const employee = await Employee.findById(payroll.employeeId);
          if (employee && employee.email) {
            await sendPayslipEmail(employee, payroll);
          }
        } catch (err) {
          console.error(`Error sending payslip for payroll ${payroll._id}:`, err.message);
        }
      }
      console.log("Completed monthly payslip email job.");
    } catch (error) {
      console.error("Cron job error:", error);
    }
  });
  console.log("Payslip cron job registered.");
};

module.exports = { startCronJobs };
