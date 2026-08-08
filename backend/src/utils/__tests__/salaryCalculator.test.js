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
    const user = null; 
    const adjustments = { leaveDays: 2 }; 

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(2000);
    expect(result.netSalary).toBe(28000);
  });

  // Test case 3: Configured default daily rate
  test('should use defaultDailyRate when configured in settings', () => {
    const employee = { monthlySalary: 30000 };
    const user = { defaultDailyRate: 1500 }; 
    const adjustments = { leaveDays: 2 }; 

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(3000);
    expect(result.netSalary).toBe(27000);
  });

  // Test case 4: Overtime hierarchy
  test('should prefer employee overtime rate over user default overtime rate', () => {
    const employee = { monthlySalary: 30000, overtimeRate: 300 };
    const user = { defaultOvertimeRate: 200 };
    const adjustments = { overtimeHours: 5 }; 

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.overtimeRate).toBe(300);
    expect(result.overtimePay).toBe(1500);
    expect(result.netSalary).toBe(31500);
  });

  // Test case 5: Overtime hierarchy fallback
  test('should fallback to user default overtime rate when employee overtime rate is 0', () => {
    const employee = { monthlySalary: 30000, overtimeRate: 0 };
    const user = { defaultOvertimeRate: 200 };
    const adjustments = { overtimeHours: 5 }; 

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.overtimeRate).toBe(200);
    expect(result.overtimePay).toBe(1000);
    expect(result.netSalary).toBe(31000);
  });

  // Test case 6: All adjustments combined
  test('should accurately calculate salary when all adjustments are active', () => {
    const employee = { monthlySalary: 50000, overtimeRate: 400 };
    const user = { defaultDailyRate: 2000 };
    const adjustments = {
      leaveDays: 1,       // -2000
      overtimeHours: 2,   // +800
      bonus: 5000,        // +5000
      deductions: 1500,   // -1500
      customDeductions: [{ amount: 500 }, { amount: 300 }] // -800
    };
    // Expected: 50000 - 2000 + 800 + 5000 - 1500 - 800 = 51500

    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(2000);
    expect(result.overtimePay).toBe(800);
    expect(result.netSalary).toBe(51500);
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

  // Test case 8: Net salary floor
  test('should floor net salary at 0 when deductions exceed base salary', () => {
    const employee = { monthlySalary: 30000 };
    const user = { defaultDailyRate: 1000 };
    const adjustments = { leaveDays: 30, deductions: 500 };
    
    const result = calculateNetSalary(employee, user, adjustments);

    expect(result.leaveDeduction).toBe(30000);
    expect(result.netSalary).toBe(0);
  });

  // Additional robust edge cases for #742 compliance
  test('should handle missing employee object gracefully', () => {
    const user = { defaultDailyRate: 100, defaultOvertimeRate: 50 };
    const adjustments = { leaveDays: 5, overtimeHours: 10 };
    
    const result = calculateNetSalary(null, user, adjustments);
    
    expect(result.baseSalary).toBe(0);
    expect(result.netSalary).toBe(500); // 0 base - 0 leave (since leave=0*5) + 500 overtime
  });

  test('should clamp excessive leave days to 31', () => {
    const employee = { monthlySalary: 30000 };
    const user = { defaultDailyRate: 1000 };
    const adjustments = { leaveDays: 50 }; // clamped to 31 -> deduction 31000
    
    const result = calculateNetSalary(employee, user, adjustments);
    
    expect(result.leaveDeduction).toBe(31000);
    expect(result.netSalary).toBe(0);
  });

  test('should handle string inputs correctly when convertible', () => {
    const employee = { monthlySalary: "40000", overtimeRate: "200" };
    const user = { defaultDailyRate: "1500" };
    const adjustments = { leaveDays: 2, bonus: 1000 };
    
    const result = calculateNetSalary(employee, user, adjustments);
    
    expect(result.baseSalary).toBe(40000);
    expect(result.leaveDeduction).toBe(3000);
    expect(result.netSalary).toBe(38000); // 40000 - 3000 + 1000
  });

  test('should ignore NaN values in custom deductions', () => {
    const employee = { monthlySalary: 20000 };
    const adjustments = { customDeductions: [{ amount: 500 }, { amount: "invalid" }, { amount: null }] };
    
    const result = calculateNetSalary(employee, null, adjustments);
    
    expect(result.netSalary).toBe(19500);
  });

  test('should fallback to 0 when string inputs are invalid', () => {
    const employee = { monthlySalary: "invalid", overtimeRate: "none" };
    
    const result = calculateNetSalary(employee, null, { leaveDays: 5 });
    
    expect(result.baseSalary).toBe(0);
    expect(result.netSalary).toBe(0);
  });

  test('should clamp extremely high overtime rate', () => {
    // max overtime rate is 1,000,000 (assumed MAX_SAFE_PAYROLL limits)
    // we test that it won't exceed MAX_SAFE_PAYROLL
    const employee = { monthlySalary: 10000, overtimeRate: 999999999 };
    
    const result = calculateNetSalary(employee, null, { overtimeHours: 2 });
    
    // It should be clamped to OVERTIME_RATE_MAX (we don't mock it, so we check if it bounds)
    expect(result.overtimeRate).toBeLessThan(999999999);
    expect(result.overtimePay).toBeGreaterThan(0);
  });

  test('should handle negative bonus or deductions safely (clamp to 0)', () => {
    const employee = { monthlySalary: 20000 };
    const adjustments = { bonus: -5000, deductions: -1000 };
    
    const result = calculateNetSalary(employee, null, adjustments);
    
    expect(result.netSalary).toBe(20000); // negative adjustments ignored
  });

  test('should ignore non-array custom deductions safely', () => {
    const employee = { monthlySalary: 20000 };
    const adjustments = { customDeductions: { amount: 500 } }; // not an array
    
    const result = calculateNetSalary(employee, null, adjustments);
    
    expect(result.netSalary).toBe(20000);
  });
});
