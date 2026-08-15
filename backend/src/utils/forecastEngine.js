/**
 * @fileoverview Payroll Forecast Engine
 * @description Iterates through active employees, applies compound increments,
 * factors in statutory employer contributions (PF/ESI), and injects "Ghost Employees"
 * to project month-over-month cash outflow for the next 12 months.
 * Issue: #985
 */

/**
 * Calculates Employer PF contribution.
 * Standard Indian PF: 12% of Basic Salary (capped at ₹15,000 basic for statutory, 
 * but many companies pay on full basic. We assume full basic for forecasting).
 * 
 * @param {number} basicSalary 
 * @returns {number}
 */
function calculateEmployerPF(basicSalary) {
    return basicSalary * 0.12;
}

/**
 * Calculates Employer ESI contribution.
 * Standard Indian ESI: 3.25% of Gross Salary (only if Gross <= ₹21,000/month).
 * 
 * @param {number} grossSalary 
 * @returns {number}
 */
function calculateEmployerESI(grossSalary) {
    if (grossSalary <= 21000) {
        return grossSalary * 0.0325;
    }
    return 0;
}

/**
 * Main forecasting engine.
 * 
 * @param {Array} employees - Array of active Employee documents (with salary structure if available)
 * @param {Object} scenario - The BudgetForecast scenario assumptions
 * @param {number} startMonth - Starting month (1-12)
 * @param {number} startYear - Starting year (e.g., 2026)
 * @returns {Array} Array of 12 monthly projection objects
 */
function projectMonthlyCashflow(employees, scenario, startMonth, startYear) {
    const projections = [];

    // Initialize base salaries for all current employees
    let currentEmployeeData = employees.map(emp => {
        // Fallback to monthlySalary if structured breakdown isn't available
        const gross = emp.monthlySalary || 0;
        // Assume 50% of gross is Basic for PF calculation if structure isn't detailed
        const basic = emp.salaryStructure?.basic || (gross * 0.5);

        return {
            id: emp._id,
            gross: gross,
            basic: basic,
            isGhost: false
        };
    });

    let currentMonth = startMonth;
    let currentYear = startYear;

    for (let i = 0; i < 12; i++) {
        let monthTotalPayroll = 0;
        let monthStatutoryCost = 0;

        // 1. Apply Increments if this is the effective month
        if (currentMonth === scenario.incrementEffectiveMonth && scenario.companyWideIncrementPercent > 0) {
            const multiplier = 1 + (scenario.companyWideIncrementPercent / 100);
            currentEmployeeData = currentEmployeeData.map(emp => ({
                ...emp,
                gross: emp.gross * multiplier,
                basic: emp.basic * multiplier
            }));
        }

        // 2. Inject Ghost Employees (Future Hires) for this specific month
        const newHiresThisMonth = (scenario.hiringPlan || []).filter(h => h.hireMonth === (i + 1));
        for (const hire of newHiresThisMonth) {
            for (let h = 0; h < hire.headcount; h++) {
                currentEmployeeData.push({
                    id: `ghost-${hire.department}-${i}-${h}`,
                    gross: hire.estimatedMonthlySalary,
                    basic: hire.estimatedMonthlySalary * 0.5, // Assume 50% basic
                    isGhost: true,
                    department: hire.department
                });
            }
        }

        // 3. Calculate costs for the current month
        for (const emp of currentEmployeeData) {
            monthTotalPayroll += emp.gross;

            let employerPF = 0;
            let employerESI = 0;

            if (scenario.includeEmployerPF) {
                employerPF = calculateEmployerPF(emp.basic);
            }
            if (scenario.includeEmployerESI) {
                employerESI = calculateEmployerESI(emp.gross);
            }

            monthStatutoryCost += (employerPF + employerESI);
        }

        projections.push({
            month: currentMonth,
            year: currentYear,
            totalPayrollCost: Math.round(monthTotalPayroll),
            employeeCount: currentEmployeeData.length,
            employerStatutoryCost: Math.round(monthStatutoryCost)
        });

        // Advance to next month
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    return projections;
}

module.exports = { projectMonthlyCashflow, calculateEmployerPF, calculateEmployerESI };
