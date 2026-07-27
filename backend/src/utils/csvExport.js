/**
 * Generates a CSV string from an array of payroll records.
 * The CSV is formatted for easy import into spreadsheet software.
 *
 * @param {Array} payrolls - Array of payroll documents from the DB
 * @param {number} month - The month (1-12)
 * @param {number} year - The year
 * @returns {string} CSV-formatted string
 */
function generatePayrollCSV(payrolls, month, year) {
  const header = [
    "Employee Name",
    "Base Salary",
    "Leave Days",
    "Leave Deduction",
    "Overtime Hours",
    "Overtime Pay",
    "Bonus",
    "Deductions",
    "Net Salary",
    "Status",
  ];

  const escapeCsvField = (value) => {
    let str = String(value);
    // Neutralize formula injection: spreadsheet apps treat a leading =, +, -, or @
    // as the start of a formula, which can execute arbitrary commands/exfiltrate data.
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    // If the value contains a comma, newline, or double-quote, wrap it in double-quotes
    if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = payrolls.map((p) =>
    [
      escapeCsvField(p.employeeName),
      p.baseSalary,
      p.leaveDays,
      p.leaveDeduction,
      p.overtimeHours,
      p.overtimePay,
      p.bonus,
      p.deductions,
      p.netSalary,
      p.status,
    ].join(",")
  );

  // Add summary row
  const totalPayout = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

  const summaryHeader = `\n\nMonth,Year,Total Employees,Total Payout`;
  const summaryRow = `${month},${year},${payrolls.length},${escapeCsvField(totalPayout)}`;

  return header.join(",") + "\n" + rows.join("\n") + summaryHeader + "\n" + summaryRow;
}

module.exports = { generatePayrollCSV };
