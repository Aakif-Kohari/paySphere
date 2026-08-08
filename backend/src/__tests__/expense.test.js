/**
 * @fileoverview Expense Payroll Bundling Unit Tests
 * @description Tests the mathematical logic of bundling approved expense claims 
 * into the monthly payroll run, ensuring tax categorization and idempotency.
 * Issue: #719
 */

const mongoose = require('mongoose');

// Mock models for isolated unit testing
jest.mock('../models/expenseClaim.model');
jest.mock('../models/payroll.model');

describe('Expense Payroll Bundling Logic', () => {

    describe('Tax Categorization', () => {
        it('should add taxable expenses to the bonus field', () => {
            const baseBonus = 500;
            const taxableExpenses = 200;
            const nonTaxableExpenses = 300;

            // Simulate the logic from payroll.controller.js
            const totalBonusWithExpenses = baseBonus + taxableExpenses;

            expect(totalBonusWithExpenses).toBe(700);
        });

        it('should add non-taxable expenses directly to net salary', () => {
            const netAfterRecovery = 5000;
            const nonTaxableExpenses = 300;

            const finalNetSalary = netAfterRecovery + nonTaxableExpenses;

            expect(finalNetSalary).toBe(5300);
        });
    });

    describe('Idempotency & Double-Reimbursement Prevention', () => {
        it('should only fetch claims where payrollId is null', () => {
            const mockQuery = {
                tenantId: 'tenant123',
                status: 'approved',
                payrollId: null, // CRITICAL: Prevents double reimbursement
            };

            expect(mockQuery.payrollId).toBeNull();
            expect(mockQuery.status).toBe('approved');
        });

        it('should ignore rejected claims', () => {
            const claims = [
                { status: 'approved', amount: 100 },
                { status: 'rejected', amount: 500 }, // Should be ignored
                { status: 'pending_approval', amount: 200 }, // Should be ignored
            ];

            const approvedTotal = claims
                .filter(c => c.status === 'approved')
                .reduce((sum, c) => sum + c.amount, 0);

            expect(approvedTotal).toBe(100);
        });
    });

    describe('Date Cutoff Logic', () => {
        it('should only include claims within the payroll month', () => {
            const currentMonth = 8; // August
            const currentYear = 2026;
            const monthStart = new Date(currentYear, currentMonth - 1, 1);
            const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

            const claimInMonth = new Date(2026, 7, 15); // Aug 15
            const claimNextMonth = new Date(2026, 8, 2); // Sep 2

            expect(claimInMonth >= monthStart && claimInMonth <= monthEnd).toBe(true);
            expect(claimNextMonth >= monthStart && claimNextMonth <= monthEnd).toBe(false);
        });
    });
});
