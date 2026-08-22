const { TalentProfile, FlightRisk, SuccessionPlan } = require('../models/SuccessionModels');

class SuccessionService {
    /**
     * Evaluates the 9-box grid position based on performance and potential
     */
    static getNineBoxCategory(performanceScore, potentialScore) {
        if (performanceScore >= 4 && potentialScore >= 4) return 'Consistent Star';
        if (performanceScore >= 4 && potentialScore === 3) return 'High Professional';
        if (performanceScore >= 4 && potentialScore <= 2) return 'Solid Performer';
        if (performanceScore === 3 && potentialScore >= 4) return 'Future Star';
        if (performanceScore === 3 && potentialScore === 3) return 'Key Player';
        if (performanceScore === 3 && potentialScore <= 2) return 'Effective Performer';
        if (performanceScore <= 2 && potentialScore >= 4) return 'Rough Diamond';
        if (performanceScore <= 2 && potentialScore === 3) return 'Inconsistent Player';
        return 'Underperformer';
    }

    /**
     * Computes comprehensive Flight Risk Score using ML heuristics
     */
    static async calculateFlightRiskScore(employeeData) {
        let riskScore = 0;
        const factors = [];

        // Salary Ratio logic
        if (employeeData.compensationRatio < 0.8) {
            riskScore += 25;
            factors.push({ factor: 'Compensation Below Market', weight: 25, impact: 'NEGATIVE' });
        } else if (employeeData.compensationRatio < 0.9) {
            riskScore += 10;
            factors.push({ factor: 'Compensation Slightly Below Market', weight: 10, impact: 'NEGATIVE' });
        } else if (employeeData.compensationRatio > 1.1) {
            factors.push({ factor: 'Highly Compensated', weight: 5, impact: 'POSITIVE' });
            riskScore = Math.max(0, riskScore - 10);
        }

        // Time in Role
        if (employeeData.timeInRole > 36 && employeeData.recentPromotions === 0) {
            riskScore += 20;
            factors.push({ factor: 'Stagnant Role Progression', weight: 20, impact: 'NEGATIVE' });
        }

        // Manager Turnover
        if (employeeData.managerTurnover > 1) {
            riskScore += 15;
            factors.push({ factor: 'High Manager Turnover', weight: 15, impact: 'NEGATIVE' });
        }

        // Sentiment Analysis (simulated)
        if (employeeData.sentimentScore < -0.5) {
            riskScore += 30;
            factors.push({ factor: 'Poor Sentiment from Surveys', weight: 30, impact: 'NEGATIVE' });
        }

        // Bound the score between 0 and 100
        riskScore = Math.min(100, Math.max(0, riskScore));

        return {
            riskScore,
            riskFactors: factors,
            projectedAttritionDate: riskScore > 75 ? new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000) : null // Projected 3 months
        };
    }

    /**
     * Generates a 9-Box Grid aggregation for a specific department or company wide
     */
    async generateTalentMatrix(department) {
        const query = department ? { department } : {};
        const profiles = await TalentProfile.find(query);

        const matrix = {
            'Consistent Star': [], 'High Professional': [], 'Solid Performer': [],
            'Future Star': [], 'Key Player': [], 'Effective Performer': [],
            'Rough Diamond': [], 'Inconsistent Player': [], 'Underperformer': []
        };

        let totalCritical = 0;

        profiles.forEach(p => {
            const category = SuccessionService.getNineBoxCategory(p.performanceScore, p.potentialScore);
            if (p.criticality === 'CRITICAL' || p.criticality === 'HIGH') {
                totalCritical++;
            }
            if (matrix[category]) {
                matrix[category].push({
                    employeeId: p.employeeId,
                    performanceScore: p.performanceScore,
                    potentialScore: p.potentialScore,
                    criticality: p.criticality,
                    readinessDelay: p.readinessDelay,
                    currentRole: p.currentRole
                });
            }
        });

        return {
            matrix,
            metadata: {
                totalEvaluated: profiles.length,
                criticalTalentRatio: profiles.length ? (totalCritical / profiles.length).toFixed(2) : 0,
                departmentAggr: department || 'Company Wide'
            }
        };
    }

    /**
     * Retrieves high flight risk critical talent (Top Flight Risk Topology)
     */
    async getFlightRiskTopology(threshold = 70) {
        const risks = await FlightRisk.find({ riskScore: { $gte: threshold } }).lean();
        const employeeIds = risks.map(r => r.employeeId);

        // Join with Talent Profiles to get criticality
        const profiles = await TalentProfile.find({ employeeId: { $in: employeeIds } }).lean();

        // Map data together
        const topology = risks.map(risk => {
            const profile = profiles.find(p => p.employeeId === risk.employeeId);
            return {
                ...risk,
                profileData: profile || null,
                financialImpact: profile ? profile.performanceScore * 25000 : 0 // Rough business impact heuristic
            };
        });

        // Sort by risk score desc
        topology.sort((a, b) => b.riskScore - a.riskScore);

        return topology;
    }

    /**
     * Proposes candidates for a succession plan using readiness and performance logic
     */
    async autoSuggestSuccessors(targetRoleId) {
        const plan = await SuccessionPlan.findOne({ targetRoleId });
        if (!plan) throw new Error('Succession plan not found');

        // Find top talent in the same department
        const topTalent = await TalentProfile.find({
            department: plan.department,
            potentialScore: { $gte: 4 },
            performanceScore: { $gte: 3 },
            currentRole: { $ne: plan.targetRoleName } // Avoid lateral exact same role 
        }).sort({ potentialScore: -1, performanceScore: -1 }).limit(5);

        const candidates = topTalent.map(talent => ({
            employeeId: talent.employeeId,
            readiness: talent.readinessDelay <= 6 ? 'READY_NOW' : (talent.readinessDelay <= 24 ? 'READY_1_2_YEARS' : 'READY_3_5_YEARS'),
            strengths: ['High Potential Indicator', 'Proven Performance'],
            developmentAreas: talent.performanceScore < 4 ? ['Further consistent delivery needed'] : [],
            status: 'PROPOSED'
        }));

        return candidates;
    }

    /**
     * Dashboard Summary API Logic
     */
    async getDashboardSummary() {
        const totalTalent = await TalentProfile.countDocuments();
        const highRiskCount = await FlightRisk.countDocuments({ riskScore: { $gte: 75 } });
        const activePlans = await SuccessionPlan.countDocuments({ status: 'ACTIVE' });
        const draftPlans = await SuccessionPlan.countDocuments({ status: 'DRAFT' });

        return {
            talentPoolSize: totalTalent,
            highFlightRiskEmployees: highRiskCount,
            successionCoverage: {
                active: activePlans,
                draft: draftPlans,
                totalRequired: 50 // Mock constant for top level roles
            }
        };
    }

    /**
     * Batch simulate data for a demo environment
     */
    async seedDemoData() {
        const mockProfiles = [];
        const mockRisks = [];
        const depts = ['Engineering', 'Sales', 'Product', 'Finance'];

        await TalentProfile.deleteMany({});
        await FlightRisk.deleteMany({});

        for (let i = 1; i <= 50; i++) {
            const empId = `EMP-10${i}`;
            const perf = Math.floor(Math.random() * 3) + 3; // 3 to 5
            const pot = Math.floor(Math.random() * 3) + 3;

            mockProfiles.push({
                employeeId: empId,
                performanceScore: perf,
                potentialScore: pot,
                criticality: pot === 5 ? 'CRITICAL' : 'MEDIUM',
                readinessDelay: Math.floor(Math.random() * 36),
                careerAspirations: 'Leadership',
                willingnessToRelocate: Math.random() > 0.5,
                department: depts[i % depts.length],
                currentRole: `Senior Contributor ${i}`
            });

            const riskScore = Math.floor(Math.random() * 100);
            mockRisks.push({
                employeeId: empId,
                riskScore,
                riskFactors: [{ factor: 'Market conditions', weight: riskScore / 2, impact: 'NEGATIVE' }],
                compensationRatio: 0.8 + (Math.random() * 0.4),
                timeInRole: Math.floor(Math.random() * 60),
                recentPromotions: Math.floor(Math.random() * 2),
                managerTurnover: Math.floor(Math.random() * 3),
                sentimentScore: (Math.random() * 2) - 1
            });
        }

        await TalentProfile.insertMany(mockProfiles);
        await FlightRisk.insertMany(mockRisks);
        return { insertedProfiles: mockProfiles.length, insertedRisks: mockRisks.length };
    }
}

module.exports = new SuccessionService();
