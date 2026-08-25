const { EquityGrant, CompanyStockValuation } = require('../models/EquityCompensationModels');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class EquityVestingService {

    /**
     * Retrieves the latest company valuation
     */
    async getLatestValuation() {
        return await CompanyStockValuation.findOne({}).sort({ valuationDate: -1 }).lean();
    }

    /**
     * Generates a forward-looking vesting schedule for a specific grant
     */
    generateVestingSchedule(grant, currentFmv) {
        const schedule = [];
        let currentVested = 0;
        const { cliffPeriodMonths, vestingPeriodMonths, totalShares, vestingStartDate } = grant;

        const cliffDate = new Date(vestingStartDate);
        cliffDate.setMonth(cliffDate.getMonth() + cliffPeriodMonths);

        // Initial Cliff Vest
        const cliffShares = Math.floor((cliffPeriodMonths / vestingPeriodMonths) * totalShares);
        schedule.push({
            date: cliffDate,
            sharesVesting: cliffShares,
            cumulativeVested: cliffShares,
            isVested: cliffDate <= new Date(),
            estimatedValue: cliffShares * currentFmv
        });

        currentVested += cliffShares;

        // Remaining periods
        const remainingMonths = vestingPeriodMonths - cliffPeriodMonths;
        const stepMonths = grant.vestingFrequency === 'MONTHLY' ? 1 : (grant.vestingFrequency === 'QUARTERLY' ? 3 : 12);
        const stepShares = Math.floor((stepMonths / vestingPeriodMonths) * totalShares);

        let nextVestDate = new Date(cliffDate);

        for (let i = 1; i <= remainingMonths / stepMonths; i++) {
            nextVestDate.setMonth(nextVestDate.getMonth() + stepMonths);

            let shares = stepShares;
            // Last tranche cleanup
            if (i === (remainingMonths / stepMonths)) {
                shares = totalShares - currentVested;
            }

            currentVested += shares;

            schedule.push({
                date: new Date(nextVestDate),
                sharesVesting: shares,
                cumulativeVested: currentVested,
                isVested: nextVestDate <= new Date(),
                estimatedValue: shares * currentFmv
            });
        }

        return schedule;
    }

    /**
     * Summarizes all enterprise unvested equity liability
     */
    async getEnterpriseLiabilitySummary() {
        const grants = await EquityGrant.find({ status: 'ACTIVE' }).lean();
        const latestFmvData = await this.getLatestValuation();
        const currentFmv = latestFmvData ? latestFmvData.fairMarketValue : 10.00; // default $10

        let totalGrantedShares = 0;
        let totalVestedShares = 0;
        let totalUnvestedShares = 0;

        const departmentLiabilities = {};

        grants.forEach(g => {
            totalGrantedShares += g.totalShares;
            const unvested = g.totalShares - g.vestedShares - g.cancelledShares;
            totalVestedShares += g.vestedShares;
            totalUnvestedShares += unvested;

            if (!departmentLiabilities[g.department]) {
                departmentLiabilities[g.department] = { unvestedShares: 0, liabilityValue: 0, employees: new Set() };
            }

            departmentLiabilities[g.department].unvestedShares += unvested;
            departmentLiabilities[g.department].liabilityValue += (unvested * currentFmv);
            departmentLiabilities[g.department].employees.add(g.employeeId);
        });

        const liabilitiesBreakdown = Object.keys(departmentLiabilities).map(dept => ({
            department: dept,
            unvestedShares: departmentLiabilities[dept].unvestedShares,
            unvestedLiabilityValue: departmentLiabilities[dept].liabilityValue,
            employeeCount: departmentLiabilities[dept].employees.size
        }));

        return {
            currentFmv,
            totalGrantedShares,
            totalVestedShares,
            totalUnvestedShares,
            totalUnvestedValue: totalUnvestedShares * currentFmv,
            liabilitiesBreakdown
        };
    }

    /**
     * Generate portfolio view for an individual employee
     */
    async getEmployeeEquityPortfolio(employeeId) {
        const grants = await EquityGrant.find({ employeeId }).lean();
        const latestFmvData = await this.getLatestValuation();
        const currentFmv = latestFmvData ? latestFmvData.fairMarketValue : 10.00;

        let totalValue = 0;
        const portfolio = grants.map(grant => {
            const schedule = this.generateVestingSchedule(grant, currentFmv);
            const unvested = grant.totalShares - grant.vestedShares - grant.cancelledShares;
            totalValue += (grant.vestedShares * currentFmv) + (unvested * currentFmv);

            return {
                ...grant,
                schedule,
                currentValue: (grant.totalShares - grant.cancelledShares) * currentFmv
            };
        });

        return {
            employeeId,
            totalPortfolioValue: totalValue,
            grants: portfolio
        };
    }

    /**
     * Top Unvested Value Holders (Retention tool)
     */
    async getTopEquityHolders(limit = 100) {
        const grants = await EquityGrant.find({ status: 'ACTIVE' }).lean();
        const employeeMap = {};

        grants.forEach(g => {
            const unvested = g.totalShares - g.vestedShares - g.cancelledShares;
            if (!employeeMap[g.employeeId]) {
                employeeMap[g.employeeId] = { employeeId: g.employeeId, department: g.department, unvestedShares: 0 };
            }
            employeeMap[g.employeeId].unvestedShares += unvested;
        });

        const sortedList = Object.values(employeeMap).sort((a, b) => b.unvestedShares - a.unvestedShares).slice(0, limit);
        return sortedList;
    }

    /**
     * Seed Mock Equity Data
     */
    async seedEquityData() {
        await EquityGrant.deleteMany({});
        await CompanyStockValuation.deleteMany({});

        // Insert Mock Valuations
        await CompanyStockValuation.insertMany([
            { valuationDate: new Date('2024-01-01'), fairMarketValue: 5.00 },
            { valuationDate: new Date('2025-01-01'), fairMarketValue: 12.50 },
            { valuationDate: new Date(), fairMarketValue: 18.75 }
        ]);

        const depts = ['Engineering', 'Sales', 'Product', 'Marketing', 'Executive'];
        const mockGrants = [];

        for (let i = 1; i <= 200; i++) {
            const dept = depts[Math.floor(Math.random() * depts.length)];
            const isExec = dept === 'Executive';
            const shares = isExec ? Math.floor(Math.random() * 50000) + 10000 : Math.floor(Math.random() * 5000) + 500;

            // Grant date somewhere in the last 2 years
            const grantDate = new Date();
            grantDate.setMonth(grantDate.getMonth() - Math.floor(Math.random() * 24));

            // Calculate mocked vested amount if past cliff
            let vested = 0;
            const monthsElapsed = (new Date().getTime() - grantDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsElapsed >= 12) {
                vested = Math.floor((monthsElapsed / 48) * shares);
                if (vested > shares) vested = shares;
            }

            mockGrants.push({
                grantId: `RSU-${10000 + i}`,
                employeeId: `EQ-${8000 + i}`,
                department: dept,
                grantType: 'RSU',
                totalShares: shares,
                grantPrice: 5.00,
                vestingStartDate: grantDate,
                cliffPeriodMonths: 12,
                vestingPeriodMonths: 48,
                vestingFrequency: 'MONTHLY',
                status: vested === shares ? 'FULLY_VESTED' : 'ACTIVE',
                vestedShares: vested
            });
        }

        await EquityGrant.insertMany(mockGrants);
        return { grantsCreated: mockGrants.length };
    }
}

module.exports = new EquityVestingService();
