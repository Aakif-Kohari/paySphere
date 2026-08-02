const { calculateNetSalary } = require('../salaryCalculator');

describe('calculateNetSalary Unit Tests', () => {
  
  // Test case 1: Baseline scenario
  test('should return base salary with zero adjustments', () => {
    const employee = { monthlySalary: 30000, overtimeRate: 0 };
    const user = { defaultDailyRate: 0, defaultOvertimeRate: 0 };
    const adjustments = { leaveDays: 0, overtimeHours: 0, bonus: 0, deductions: 0 };

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.baseSalary).toBe(30000);
    expect(result.netSalary).toBe(30000);
    expect(result.leaveDeduction).toBe(0);
    expect(result.overtimePay).toBe(0);
  });

  // Test case 2: Fallback daily rate for leave deduction
  test('should fallback to baseSalary / 30 for daily rate when defaultDailyRate is not configured', () => {
    const employee = { monthlySalary: 30000 };
    const user = null; // No configured settings
    const adjustments = { leaveDays: 2 }; // 30000 / 30 = 1000 per day; deduction should be 2000

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(2000);
    expect(result.netSalary).toBe(28000);
  });

  // Test case 3: Configured default daily rate
  test('should use defaultDailyRate when configured in settings', () => {
    const employee = { monthlySalary: 30000 };
    const user = { defaultDailyRate: 1500 }; // Configured rate overrides 30000 / 30
    const adjustments = { leaveDays: 2 }; // Deduction should be 3000

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(3000);
    expect(result.netSalary).toBe(27000);
  });

  // Test case 4: Overtime hierarchy (Employee rate overrides default)
  test('should prefer employee overtime rate over user default overtime rate', () => {
    const employee = { monthlySalary: 30000, overtimeRate: 300 };
    const user = { defaultOvertimeRate: 200 };
    const adjustments = { overtimeHours: 5 }; // Overtime pay should be 1500

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.overtimeRate).toBe(300);
    expect(result.overtimePay).toBe(1500);
    expect(result.netSalary).toBe(31500);
  });

  // Test case 5: Overtime hierarchy (Use user default if employee rate is 0)
  test('should fallback to user default overtime rate when employee overtime rate is 0', () => {
    const employee = { monthlySalary: 30000, overtimeRate: 0 };
    const user = { defaultOvertimeRate: 200 };
    const adjustments = { overtimeHours: 5 }; // Overtime pay should be 1000

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.overtimeRate).toBe(200);
    expect(result.overtimePay).toBe(1000);
    expect(result.netSalary).toBe(31000);
  });

  // Test case 6: All adjustments combined
  test('should accurately calculate salary when all adjustments (leave, overtime, bonus, deductions) are active', () => {
    const employee = { monthlySalary: 50000, overtimeRate: 400 };
    const user = { defaultDailyRate: 2000 };
    const adjustments = {
      leaveDays: 1,       // -2000
      overtimeHours: 2,   // +800
      bonus: 5000,        // +5000
      deductions: 1500    // -1500
    };
    // Expected: 50000 - 2000 + 800 + 5000 - 1500 = 52300

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(2000);
    expect(result.overtimePay).toBe(800);
    expect(result.netSalary).toBe(52300);
  });

  // Test case 7: Check rounding behaviors
  test('should round leave deduction and overtime pay to the nearest integer', () => {
    const employee = { monthlySalary: 35005, overtimeRate: 150.75 };
    const user = { defaultDailyRate: 1166.85 };
    const adjustments = { leaveDays: 1, overtimeHours: 1 };
    
    // leaveDeduction: 1166.85 * 1 = 1167
    // overtimePay: 150.75 * 1 = 151
    // netSalary: 35005 - 1167 + 151 = 33989

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(1167);
    expect(result.overtimePay).toBe(151);
    expect(result.netSalary).toBe(33989);
  });

  // Test case 8: Net salary should never go negative
  test('should floor net salary at 0 when deductions exceed base salary', () => {
    const employee = { monthlySalary: 30000 };
    const user = { defaultDailyRate: 1000 };
    const adjustments = { leaveDays: 30, deductions: 500 };
    // leaveDeduction: 1000 * 30 = 30000; netSalary would be 30000 - 30000 - 500 = -500

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(30000);
    expect(result.netSalary).toBe(0);
  });
});
