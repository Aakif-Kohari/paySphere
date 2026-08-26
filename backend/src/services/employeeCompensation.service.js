const PDFDocument = require('pdfkit');
const PayrollUpdate = require('../models/payroll.model');
const SalaryHistory = require('../models/salaryHistory.model');
const Employee = require('../models/employee.model');
const { PAYROLL_STATUS } = require('../config/payrollStatus');

/**
 * Service to aggregate and analyze employee compensation data over time.
 */
class EmployeeCompensationService {
  /**
   * Retrieves a longitudinal timeline of an employee's compensation history.
   * Includes both actual payouts (from PayrollUpdate) and salary structure changes.
   */
  async getCompensationTimeline(employeeId, tenantId) {
    // Fetch all finalized/approved payrolls for this employee
    const payrolls = await PayrollUpdate.find({
      employeeId,
      tenantId,
      status: {
        $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.DISBURSED, 'FINALIZED'],
      },
    })
      .sort({ year: 1, month: 1 })
      .lean();

    // Fetch salary history
    const salaryHistory = await SalaryHistory.find({
      employeeId,
      tenantId,
    })
      .sort({ createdAt: 1 })
      .lean();

    // Aggregate into a timeline
    const timeline = payrolls.map((p) => {
      // Find the active salary at this point in time based on salaryHistory
      // Or fallback to the snapshot if available
      const ctc =
        p.salarySnapshot?.effectiveGross || p.baseSalary + (p.bonus || 0); // Approximation if no snapshot

      return {
        month: p.month,
        year: p.year,
        period: `${p.year}-${String(p.month).padStart(2, '0')}`,
        baseSalary: p.baseSalary || 0,
        bonus: p.bonus || 0,
        overtimePay: p.overtimePay || 0,
        grossPay: (p.baseSalary || 0) + (p.bonus || 0) + (p.overtimePay || 0),
        deductions: p.deductions || 0,
        netPay: p.netSalary || 0,
        ctc: ctc,
        currency: p.currency || 'INR',
      };
    });

    return {
      timeline,
      salaryRevisions: salaryHistory.map((sh) => ({
        date: sh.createdAt,
        previousSalary: sh.previousSalary,
        newSalary: sh.newSalary,
        reason: sh.reason,
        percentageChange: sh.percentageChange,
        currency: sh.currency,
      })),
    };
  }

  /**
   * Calculates the Year-to-Date (YTD) summary for a specific financial year.
   * Indian Financial Year: April 1st to March 31st.
   */
  async getYTDSummary(employeeId, tenantId, financialYearStart) {
    const startYear = parseInt(financialYearStart, 10);
    const endYear = startYear + 1;

    // We need payrolls from April of startYear to March of endYear
    const payrolls = await PayrollUpdate.find({
      employeeId,
      tenantId,
      status: {
        $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.DISBURSED, 'FINALIZED'],
      },
      $or: [
        { year: startYear, month: { $gte: 4 } },
        { year: endYear, month: { $lte: 3 } },
      ],
    }).lean();

    const summary = payrolls.reduce(
      (acc, p) => {
        acc.grossEarnings +=
          (p.baseSalary || 0) + (p.bonus || 0) + (p.overtimePay || 0);
        acc.totalDeductions += p.deductions || 0;
        acc.netPay += p.netSalary || 0;
        return acc;
      },
      {
        financialYear: `${startYear}-${endYear}`,
        grossEarnings: 0,
        totalDeductions: 0,
        netPay: 0,
        currency: payrolls.length > 0 ? payrolls[0].currency : 'INR',
        monthsProcessed: payrolls.length,
      },
    );

    return summary;
  }

  /**
   * Generates a PDF statement of the compensation timeline and YTD.
   */
  async generateStatementPDF(employeeId, tenantId, financialYearStart) {
    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId,
    }).lean();
    if (!employee) throw new Error('Employee not found');

    const ytd = await this.getYTDSummary(
      employeeId,
      tenantId,
      financialYearStart,
    );
    const { timeline } = await this.getCompensationTimeline(
      employeeId,
      tenantId,
    );

    // Filter timeline to just this FY
    const startYear = parseInt(financialYearStart, 10);
    const endYear = startYear + 1;
    const fyTimeline = timeline.filter(
      (t) =>
        (t.year === startYear && t.month >= 4) ||
        (t.year === endYear && t.month <= 3),
    );

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc
          .fontSize(20)
          .text('Annual Compensation Statement', { align: 'center' });
        doc.moveDown();
        doc
          .fontSize(12)
          .text(`Employee: ${employee.firstName} ${employee.lastName}`);
        doc.text(`Employee ID: ${employee.employeeId || employee._id}`);
        doc.text(`Financial Year: ${ytd.financialYear}`);
        doc.moveDown();

        // YTD Summary
        doc.fontSize(16).text('Year-to-Date Summary');
        doc
          .fontSize(12)
          .text(
            `Gross Earnings: ${ytd.currency} ${ytd.grossEarnings.toFixed(2)}`,
          );
        doc.text(
          `Total Deductions: ${ytd.currency} ${ytd.totalDeductions.toFixed(2)}`,
        );
        doc.text(`Net Take-Home Pay: ${ytd.currency} ${ytd.netPay.toFixed(2)}`);
        doc.moveDown();

        // Monthly Breakdown
        doc.fontSize(16).text('Monthly Breakdown');
        doc.moveDown();

        // Simple Table Header
        const startX = 50;
        let startY = doc.y;
        doc.fontSize(10);
        doc.text('Period', startX, startY);
        doc.text('Gross', startX + 100, startY);
        doc.text('Deductions', startX + 200, startY);
        doc.text('Net Pay', startX + 300, startY);

        doc
          .moveTo(startX, startY + 15)
          .lineTo(550, startY + 15)
          .stroke();
        startY += 25;

        fyTimeline.forEach((month) => {
          doc.text(month.period, startX, startY);
          doc.text(month.grossPay.toFixed(2), startX + 100, startY);
          doc.text(month.deductions.toFixed(2), startX + 200, startY);
          doc.text(month.netPay.toFixed(2), startX + 300, startY);
          startY += 20;

          // Add page if needed
          if (startY > 700) {
            doc.addPage();
            startY = 50;
          }
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new EmployeeCompensationService();
