const { ExpatAssignment, GlobalMobilityStats } = require('../models/GlobalMobilityModels');

class ExpatTaxService {

    /**
     * Calculates the Tax Equalization disparity and total corporate liability for a specific assignment.
     */
    calculateAssignmentLiability(assignment) {
        const { baseSalary, housingAllowance, COLAAllowance, hardshipPremium, homeTaxRate, hostTaxRate, taxPolicyType } = assignment;

        // Total taxable income in host country (simplified model)
        const grossIncome = baseSalary + housingAllowance + COLAAllowance + hardshipPremium;

        // Hypothetical Tax (What they would have paid at home on base salary alone)
        const hypotheticalTax = baseSalary * (homeTaxRate / 100);

        // Actual Host Tax
        const actualHostTax = grossIncome * (hostTaxRate / 100);

        // Tax Differential Liability (Company pays the difference if Host Tax > Hypothetical Tax under EQUALIZATION)
        let companyLiability = 0;

        if (taxPolicyType === 'EQUALIZATION') {
            companyLiability = actualHostTax - hypotheticalTax;
            // Note: in true equalization, if host tax is LESS than home tax, company withholds the difference (negative liability = profit).
        } else if (taxPolicyType === 'PROTECTION') {
            companyLiability = actualHostTax > hypotheticalTax ? (actualHostTax - hypotheticalTax) : 0;
            // Company pays excess, but doesn't take the benefit if tax is lower
        }

        const totalPackageCost = grossIncome + Math.max(0, companyLiability);

        return {
            grossIncome,
            hypotheticalTax,
            actualHostTax,
            companyLiability,
            totalPackageCost,
            isCompanyBenefit: companyLiability < 0
        };
    }

    /**
     * Retrieves enterprise-wide global mobility liability totals and geography metrics.
     */
    async getEnterpriseMobilitySummary() {
        const activeAssignments = await ExpatAssignment.find({ status: 'ACTIVE' }).lean();

        let totalAssignments = 0;
        let totalTaxLiability = 0;
        let totalRelocationspend = 0;
        let totalPackageCosts = 0;

        const hostCountryCounts = {};
        const homeCountryCounts = {};

        activeAssignments.forEach(assignment => {
            const calc = this.calculateAssignmentLiability(assignment);
            totalAssignments++;
            totalTaxLiability += calc.companyLiability;
            totalPackageCosts += calc.totalPackageCost;
            totalRelocationspend += (assignment.relocationBudget || 0);

            hostCountryCounts[assignment.hostCountry] = (hostCountryCounts[assignment.hostCountry] || 0) + 1;
            homeCountryCounts[assignment.homeCountry] = (homeCountryCounts[assignment.homeCountry] || 0) + 1;
        });

        const hostCountryMetrics = Object.keys(hostCountryCounts).map(host => {
            // Find avg tax diff to this country
            const countryAssigns = activeAssignments.filter(a => a.hostCountry === host);
            let liabilitySum = 0;
            countryAssigns.forEach(a => liabilitySum += this.calculateAssignmentLiability(a).companyLiability);

            return {
                country: host,
                activeExpats: hostCountryCounts[host],
                totalTaxLiability: liabilitySum,
                avgTaxLiabilityPerExpat: liabilitySum / hostCountryCounts[host]
            };
        }).sort((a, b) => b.activeExpats - a.activeExpats);

        return {
            totalActiveExpats: totalAssignments,
            aggregateTaxEqualizationLiability: totalTaxLiability,
            aggregateRelocationBudgets: totalRelocationspend,
            aggregateTotalCost: totalPackageCosts,
            corridorTopology: hostCountryMetrics
        };
    }

    /**
     * Retrieves a paginated list of high-cost assignments based on tax liability
     */
    async getHighCostAssignments(limit = 100) {
        const assignments = await ExpatAssignment.find({ status: 'ACTIVE' }).lean();

        const enriched = assignments.map(a => {
            const calc = this.calculateAssignmentLiability(a);
            return {
                ...a,
                financials: calc
            };
        });

        return enriched.sort((a, b) => b.financials.companyLiability - a.financials.companyLiability).slice(0, limit);
    }

    /**
     * Generates mocked expat data around the globe.
     */
    async seedDemoData() {
        await ExpatAssignment.deleteMany({});

        const countries = [
            { name: 'United Arab Emirates', taxRate: 0 },
            { name: 'Singapore', taxRate: 15 },
            { name: 'United Kingdom', taxRate: 45 },
            { name: 'Germany', taxRate: 42 },
            { name: 'Japan', taxRate: 40 },
            { name: 'United States', taxRate: 37 },
            { name: 'Australia', taxRate: 45 },
            { name: 'Switzerland', taxRate: 11 }
        ];

        const depts = ['Engineering', 'Executive', 'Sales', 'Operations', 'Legal'];

        const mockGrants = [];

        for (let i = 1; i <= 350; i++) {
            // Pick Home and Host
            let home = countries[Math.floor(Math.random() * countries.length)];
            let host = countries[Math.floor(Math.random() * countries.length)];
            while (home.name === host.name) {
                host = countries[Math.floor(Math.random() * countries.length)];
            }

            const baseSalary = 80000 + Math.random() * 150000;

            mockGrants.push({
                assignmentId: `EXPAT-${10000 + i}`,
                employeeId: `EMP-${7000 + i}`,
                department: depts[Math.floor(Math.random() * depts.length)],
                homeCountry: home.name,
                hostCountry: host.name,
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)), // 2 year assigns
                status: i % 10 === 0 ? 'REPATRIATED' : 'ACTIVE',
                taxPolicyType: i % 5 === 0 ? 'PROTECTION' : 'EQUALIZATION',
                homeTaxRate: home.taxRate,
                hostTaxRate: host.taxRate,
                relocationBudget: Math.random() * 50000 + 10000,
                housingAllowance: Math.random() * 40000 + 10000,
                COLAAllowance: Math.random() * 20000,
                hardshipPremium: Math.random() > 0.8 ? 15000 : 0, // 20% go to hardship
                baseSalary,
                currency: 'USD'
            });
        }

        await ExpatAssignment.insertMany(mockGrants);
        return { recordsSeeded: mockGrants.length };
    }
}

module.exports = new ExpatTaxService();
