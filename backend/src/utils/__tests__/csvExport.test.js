const { generatePayrollCSV } = require("../csvExport");

describe("generatePayrollCSV", () => {
  const samplePayrolls = [
    {
      employeeName: "Rahul Sharma",
      baseSalary: 45000,
      leaveDays: 2,
      leaveDeduction: 3000,
      overtimeHours: 5,
      overtimePay: 1250,
      bonus: 2000,
      deductions: 500,
      netSalary: 44750,
      status: "finalized",
    },
    {
      employeeName: "Priya Patel",
      baseSalary: 60000,
      leaveDays: 0,
      leaveDeduction: 0,
      overtimeHours: 0,
      overtimePay: 0,
      bonus: 0,
      deductions: 0,
      netSalary: 60000,
      status: "finalized",
    },
  ];

  test("should return a string", () => {
    const result = generatePayrollCSV(samplePayrolls, 4, 2026);
    expect(typeof result).toBe("string");
  });

  test("should include CSV header row", () => {
    const result = generatePayrollCSV(samplePayrolls, 4, 2026);
    const lines = result.split("\n");
    expect(lines[0]).toContain("Employee Name");
    expect(lines[0]).toContain("Base Salary");
    expect(lines[0]).toContain("Net Salary");
    expect(lines[0]).toContain("Status");
  });

  test("should include all employee records", () => {
    const result = generatePayrollCSV(samplePayrolls, 4, 2026);
    expect(result).toContain("Rahul Sharma");
    expect(result).toContain("Priya Patel");
  });

  test("should include summary section with month, year, total employees, and total payout", () => {
    const result = generatePayrollCSV(samplePayrolls, 4, 2026);
    expect(result).toContain("Month,Year,Total Employees,Total Payout");
    expect(result).toContain("4,2026,2");
    // Total payout = 44750 + 60000 = 104750
    expect(result).toContain("104750");
  });

  test("should handle empty payroll array", () => {
    const result = generatePayrollCSV([], 4, 2026);
    const lines = result.split("\n");
    expect(lines[0]).toContain("Employee Name");
    // Should still include summary with 0 employees and 0 payout
    expect(result).toContain("4,2026,0");
    expect(result).toContain("0");
  });

  test("should escape fields containing commas", () => {
    const payrollsWithComma = [
      {
        employeeName: "Sharma, Rahul",
        baseSalary: 30000,
        leaveDays: 0,
        leaveDeduction: 0,
        overtimeHours: 0,
        overtimePay: 0,
        bonus: 0,
        deductions: 0,
        netSalary: 30000,
        status: "finalized",
      },
    ];
    const result = generatePayrollCSV(payrollsWithComma, 4, 2026);
    // The name with a comma should be wrapped in double quotes
    expect(result).toContain('"Sharma, Rahul"');
  });

  test("should escape fields containing double quotes", () => {
    const payrollsWithQuotes = [
      {
        employeeName: 'Rahul "The Boss" Sharma',
        baseSalary: 50000,
        leaveDays: 0,
        leaveDeduction: 0,
        overtimeHours: 0,
        overtimePay: 0,
        bonus: 0,
        deductions: 0,
        netSalary: 50000,
        status: "finalized",
      },
    ];
    const result = generatePayrollCSV(payrollsWithQuotes, 4, 2026);
    // Double quotes inside a field should be doubled
    expect(result).toContain('"Rahul ""The Boss"" Sharma"');
  });

  test("should neutralize formula-injection payloads in employee name", () => {
    const payrollsWithFormula = [
      {
        employeeName: '=HYPERLINK("http://evil.example/steal","Click")',
        baseSalary: 30000,
        leaveDays: 0,
        leaveDeduction: 0,
        overtimeHours: 0,
        overtimePay: 0,
        bonus: 0,
        deductions: 0,
        netSalary: 30000,
        status: "finalized",
      },
    ];
    const result = generatePayrollCSV(payrollsWithFormula, 4, 2026);
    // A leading apostrophe forces spreadsheet apps to treat it as text, not a formula
    expect(result).toContain("'=HYPERLINK");
    expect(result).not.toMatch(/,=HYPERLINK/);
  });
});
