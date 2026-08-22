const { KeyRole, SuccessionCandidate } = require('../models/SuccessionModels');
const { v4: uuidv4 } = require('uuid');

class SuccessionService {
    async getRoles(query = {}) {
        try {
            const matchStage = {};
            if (query.department) matchStage.department = query.department;
            if (query.status) matchStage.status = query.status;

            return await KeyRole.find(matchStage).sort({ businessImpactScore: -1 });
        } catch (error) {
            throw new Error(`Failed to fetch key roles: ${error.message}`);
        }
    }

    async getCandidates(page = 1, limit = 50, filters = {}) {
        try {
            const skip = (page - 1) * limit;
            const matchStage = {};

            if (filters.targetRoleId) matchStage.targetRoleId = filters.targetRoleId;
            if (filters.gridPlacement) matchStage['nineBoxGrid.gridPlacement'] = filters.gridPlacement;

            const candidates = await SuccessionCandidate.find(matchStage)
                .populate('targetRoleId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await SuccessionCandidate.countDocuments(matchStage);

            return {
                data: candidates,
                pagination: {
                    total,
                    page: Number(page),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to fetch succession candidates: ${error.message}`);
        }
    }

    async calculateFlightRiskTopology() {
        try {
            const topology = await KeyRole.aggregate([
                {
                    $lookup: {
                        from: 'successioncandidates',
                        localField: '_id',
                        foreignField: 'targetRoleId',
                        as: 'candidates'
                    }
                },
                {
                    $group: {
                        _id: '$department',
                        totalCriticalRoles: { $sum: 1 },
                        rolesAtRisk: {
                            $sum: { $cond: [{ $eq: ['$status', 'AT_RISK'] }, 1, 0] }
                        },
                        rolesVacant: {
                            $sum: { $cond: [{ $eq: ['$status', 'VACANT'] }, 1, 0] }
                        },
                        totalCandidatesReadyNow: {
                            $sum: {
                                $size: {
                                    $filter: {
                                        input: '$candidates',
                                        as: 'c',
                                        cond: { $eq: ['$$c.readinessTimeline', 'READY_NOW'] }
                                    }
                                }
                            }
                        },
                        avgBusinessImpact: { $avg: '$businessImpactScore' }
                    }
                },
                { $sort: { rolesAtRisk: -1 } }
            ]);

            return topology.map(dept => ({
                department: dept._id,
                criticalRoles: dept.totalCriticalRoles,
                atRisk: dept.rolesAtRisk,
                vacant: dept.rolesVacant,
                benchStrength: dept.totalCandidatesReadyNow,
                impact: dept.avgBusinessImpact
            }));
        } catch (error) {
            throw new Error(`Topology calculation failed: ${error.message}`);
        }
    }

    async seedMockData() {
        try {
            const rolesExist = await KeyRole.countDocuments();
            if (rolesExist > 0) return { message: 'Database already seeded with Succession data.' };

            const depts = ['Engineering', 'Product', 'Sales', 'Finance', 'Legal', 'Operations'];
            const statuses = ['STABLE', 'STABLE', 'STABLE', 'AT_RISK', 'VACANT'];
            const flightRisks = ['LOW', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

            const savedRoles = [];
            for (let i = 0; i < 40; i++) {
                const status = statuses[Math.floor(Math.random() * statuses.length)];

                savedRoles.push(await KeyRole.create({
                    roleId: `R-${uuidv4().substring(0, 6).toUpperCase()}`,
                    title: `VP ${depts[Math.floor(Math.random() * depts.length)]} Operations`,
                    department: depts[Math.floor(Math.random() * depts.length)],
                    criticalityLevel: i % 4 === 0 ? 'CRITICAL' : 'HIGH',
                    businessImpactScore: 60 + Math.floor(Math.random() * 40),
                    currentIncumbent: status === 'VACANT' ? null : {
                        employeeId: `EMP-${Math.floor(Math.random() * 90000)}`,
                        name: `Executive ${uuidv4().substring(0, 4)}`,
                        flightRisk: flightRisks[Math.floor(Math.random() * flightRisks.length)],
                        retirementWindow: ['< 1 YEAR', '1-3 YEARS', '3-5 YEARS', '5+ YEARS'][Math.floor(Math.random() * 4)]
                    },
                    status: status
                }));
            }

            const potPerf = ['LOW', 'MODERATE', 'HIGH'];
            const timelines = ['READY_NOW', 'READY_IN_1_YEAR', 'READY_IN_3_YEARS'];

            for (let i = 0; i < 150; i++) {
                const role = savedRoles[Math.floor(Math.random() * savedRoles.length)];
                const pot = potPerf[Math.floor(Math.random() * potPerf.length)];
                const perf = potPerf[Math.floor(Math.random() * potPerf.length)];

                await SuccessionCandidate.create({
                    candidateId: `B-${uuidv4().substring(0, 6).toUpperCase()}`,
                    targetRoleId: role._id,
                    employeeName: `Candidate ${uuidv4().substring(0, 6)}`,
                    currentRole: `Director ${role.department}`,
                    readinessTimeline: timelines[Math.floor(Math.random() * timelines.length)],
                    nineBoxGrid: { potential: pot, performance: perf },
                    skillsGap: ['Leadership', 'Strategic Vision', 'P&L Management'].slice(0, Math.floor(Math.random() * 3))
                });
            }

            return { message: 'Succession data seeded successfully' };
        } catch (error) {
            throw new Error(`Seeding failed: ${error.message}`);
        }
    }
}

module.exports = new SuccessionService();
