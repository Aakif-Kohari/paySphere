/**
 * @fileoverview Amortization Engine
 * @description Calculates EMIs, generates deduction schedules, and enforces 
 * minimum wage guardrails to protect employee net pay.
 * Issue: #1290
 */

/**
 * Calculates the monthly EMI based on principal, rate, tenure, and interest type.
 * @param {number} principal 
 * @param {number} annualRate - Percentage (e.g., 12 for 12%)
 * @param {number} tenureMonths 
 * @param {string} type - 'Flat' or 'Reducing'
 * @returns {{ emi: number, totalInterest: number, totalPayment: number }}
 */
function calculateEMI(principal, annualRate, tenureMonths, type) {
    if (tenureMonths <= 0) return { emi: principal, totalInterest: 0, totalPayment: principal };

    const monthlyRate = annualRate / 12 / 100;

    if (type === 'Flat' || annualRate === 0) {
        const totalInterest = principal * (annualRate / 100) * (tenureMonths / 12);
        const totalPayment = principal + totalInterest;
        const emi = totalPayment / tenureMonths;
        return { emi: Math.round(emi * 100) / 100, totalInterest, totalPayment };
    }

    // Reducing Balance Formula: EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);

    const totalPayment = emi * tenureMonths;
    const totalInterest = totalPayment - principal;

    return {
        emi: Math.round(emi * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100
    };
}

/**
 * Generates the monthly amortization schedule for an approved loan.
 * @param {Object} loan - The approved LoanRequest document
 * @param {Date} startDate - The month/year to start deductions
 * @returns {Array<Object>} Array of schedule objects
 */
function generateSchedule(loan, startDate) {
    const schedule = [];
    const { emi } = calculateEMI(loan.principalAmount, loan.interestRate, loan.tenureMonths, 'Flat'); // Simplified for demo

    let currentMonth = startDate.getMonth() + 1;
    let currentYear = startDate.getFullYear();

    let remainingPrincipal = loan.principalAmount;
    const monthlyPrincipal = loan.principalAmount / loan.tenureMonths;
    const monthlyInterest = (loan.principalAmount * (loan.interestRate / 100)) / loan.tenureMonths;

    for (let i = 0; i < loan.tenureMonths; i++) {
        schedule.push({
            tenantId: loan.tenantId,
            loanId: loan._id,
            employeeId: loan.employeeId,
            month: currentMonth,
            year: currentYear,
            principalComponent: Math.round(monthlyPrincipal * 100) / 100,
            interestComponent: Math.round(monthlyInterest * 100) / 100,
            totalEmi: emi,
            status: 'Pending'
        });

        remainingPrincipal -= monthlyPrincipal;
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    return schedule;
}

/**
 * Minimum Wage Guardrail: Checks if deducting the EMI will drop the employee's 
 * net pay below the statutory minimum. If so, defers the EMI.
 * 
 * @param {number} projectedNetPay - Employee's net pay before EMI deduction
 * @param {number} emiAmount - The EMI to be deducted
 * @param {number} minimumWageThreshold - The statutory minimum net pay
 * @returns {{ isSafe: boolean, deferredAmount: number, reason: string }}
 */
function checkMinimumWageGuardrail(projectedNetPay, emiAmount, minimumWageThreshold) {
    const remainingPay = projectedNetPay - emiAmount;

    if (remainingPay < minimumWageThreshold) {
        const maxAllowedDeduction = Math.max(0, projectedNetPay - minimumWageThreshold);
        return {
            isSafe: false,
            deferredAmount: emiAmount - maxAllowedDeduction,
            reason: `EMI deferred to protect minimum wage. Max allowed deduction: ${maxAllowedDeduction}.`
        };
    }

    return { isSafe: true, deferredAmount: 0, reason: '' };
}

module.exports = { calculateEMI, generateSchedule, checkMinimumWageGuardrail };
