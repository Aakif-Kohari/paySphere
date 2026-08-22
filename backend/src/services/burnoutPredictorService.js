const { BurnoutTelemetry, WellnessInterventionLog } = require('../models/BurnoutRiskModels');

class BurnoutPredictorService {

    /**
     * Run the heuristic inference engine to calculate burnout risk scores
     */
    async calculateBurnoutRisk(employeeData) {
        let score = 0;

        // Workload factors
        if (employeeData.averageWeeklyHours > 50) score += 20;
        if (employeeData.averageWeeklyHours > 60) score += 15;

        score += (employeeData.weekendHoursLogged * 2.5); // high penalty for weekends
        score += (employeeData.afterHoursCommunications * 0.5); // death by small cuts

        // PTO factor
        if (employeeData.daysSinceLastPto > 90) score += 15;
        if (employeeData.daysSinceLastPto > 180) score += 15;

        // Sentiment factor
        if (employeeData.sentimentScore < 0) score += (Math.abs(employeeData.sentimentScore) * 30);

        // Engagement
        if (employeeData.engagementIndex < 50) score += 20;

        // Protective factors (reduces risk)
        if (employeeData.manager1on1Frequency <= 14) score -= 10;
        if (employeeData.peerRecognitionCount > 5) score -= 15;

        score = Math.min(100, Math.max(0, score));

        let category = 'LOW';
        if (score >= 40) category = 'MODERATE';
        if (score >= 70) category = 'HIGH';
        if (score >= 85) category = 'CRITICAL';

        return { score, category };
    }

    /**
     * Generates department level aggregates for the heatmap
     */
    async getDepartmentHeatmapData() {
        const telemetry = await BurnoutTelemetry.find({}).lean();

        const aggregates = {};
        telemetry.forEach(t => {
            if (!aggregates[t.department]) {
                aggregates[t.department] = {
                    total: 0,
                    critical: 0,
                    high: 0,
                    moderate: 0,
                    low: 0,
                    avgScore: 0,
                    avgHours: 0
                };
            }
            const dept = aggregates[t.department];
            dept.total++;
            dept.avgScore += t.burnoutRiskScore;
            dept.avgHours += t.averageWeeklyHours;

            if (t.riskCategory === 'CRITICAL') dept.critical++;
            else if (t.riskCategory === 'HIGH') dept.high++;
            else if (t.riskCategory === 'MODERATE') dept.moderate++;
            else dept.low++;
        });

        return Object.keys(aggregates).map(dept => {
            const data = aggregates[dept];
            data.avgScore = Math.round(data.avgScore / data.total);
            data.avgHours = Math.round(data.avgHours / data.total);
            return { department: dept, ...data };
        });
    }

    /**
     * Retrieves high-risk top offenders for targeted interventions
     */
    async getHighRiskTopology(limit = 100) {
        return await BurnoutTelemetry.find({ burnoutRiskScore: { $gte: 70 } })
            .sort({ burnoutRiskScore: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Auto-suggests and creates wellness interventions for critical staff
     */
    async autoGenerateInterventions() {
        const criticalStaff = await BurnoutTelemetry.find({ riskCategory: 'CRITICAL' }).lean();
        const createdLogs = [];

        for (let current of criticalStaff) {
            // Check if intervention already exists
            const existing = await WellnessInterventionLog.findOne({
                employeeId: current.employeeId,
                status: { $in: ['PROPOSED', 'ACTIVE'] }
            });

            if (!existing) {
                let action = 'COACHING';
                if (current.daysSinceLastPto > 120) action = 'MANDATORY_PTO';
                else if (current.averageWeeklyHours > 55) action = 'WORKLOAD_REBALANCING';

                const log = new WellnessInterventionLog({
                    employeeId: current.employeeId,
                    interventionType: action,
                    triggeredBy: 'SYSTEM_AI',
                    status: 'PROPOSED',
                    followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                });
                await log.save();
                createdLogs.push(log);
            }
        }
        return createdLogs;
    }

    /**
     * Generates mock data for demonstration
     */
    async seedDemoData() {
        await BurnoutTelemetry.deleteMany({});
        await WellnessInterventionLog.deleteMany({});

        const depts = ['Engineering', 'Sales', 'Product', 'Marketing', 'Customer Support', 'Finance'];
        const mockData = [];

        for (let i = 1; i <= 250; i++) {
            const hours = Math.floor(Math.random() * 25) + 40; // 40-65 hrs
            const pto = Math.floor(Math.random() * 300); // 0-300 days
            const sentiment = (Math.random() * 2) - 1.0; // -1 to 1

            const empData = {
                employeeId: `EMP-${9000 + i}`,
                department: depts[Math.floor(Math.random() * depts.length)],
                averageWeeklyHours: hours,
                weekendHoursLogged: hours > 50 ? Math.floor(Math.random() * 8) : 0,
                afterHoursCommunications: Math.floor(Math.random() * 20),
                daysSinceLastPto: pto,
                sentimentScore: sentiment,
                engagementIndex: Math.floor(Math.random() * 100),
                manager1on1Frequency: Math.floor(Math.random() * 30),
                peerRecognitionCount: Math.floor(Math.random() * 10),
                sickDaysTaken: Math.floor(Math.random() * 5)
            };

            const { score, category } = await this.calculateBurnoutRisk(empData);
            empData.burnoutRiskScore = score;
            empData.riskCategory = category;

            mockData.push(empData);
        }

        await BurnoutTelemetry.insertMany(mockData);

        // Auto generate some interventions
        await this.autoGenerateInterventions();

        return { seededCount: mockData.length };
    }
}

module.exports = new BurnoutPredictorService();
