const { ExpatWorker, VisaSponsorship } = require('../models/ImmigrationModels');
const { v4: uuidv4 } = require('uuid');

class ImmigrationService {
    async getWorkers(query = {}) {
        try {
            const matchStage = {};
            if (query.hostCountry) matchStage.hostCountry = query.hostCountry;
            if (query.status) matchStage.overallComplianceStatus = query.status;

            return await ExpatWorker.find(matchStage).sort({ createdAt: -1 });
        } catch (error) {
            throw new Error(`Failed to fetch expat workers: ${error.message}`);
        }
    }

    async getSponsorships(page = 1, limit = 50, filters = {}) {
        try {
            const skip = (page - 1) * limit;
            const matchStage = {};

            if (filters.status) matchStage.visaStatus = filters.status;
            if (filters.riskLevel) matchStage.riskLevel = filters.riskLevel;

            const sponsorships = await VisaSponsorship.find(matchStage)
                .populate('workerId')
                .sort({ expirationDate: 1 }) // SORT BY EXPIRATION
                .skip(skip)
                .limit(limit);

            const total = await VisaSponsorship.countDocuments(matchStage);

            return {
                data: sponsorships,
                pagination: {
                    total,
                    page: Number(page),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to fetch visa sponsorships: ${error.message}`);
        }
    }

    async calculateImmigrationRisk() {
        try {
            // Aggregate risk profile across different host countries for the visualizer
            const riskData = await VisaSponsorship.aggregate([
                {
                    $lookup: {
                        from: 'expatworkers',
                        localField: 'workerId',
                        foreignField: '_id',
                        as: 'workerInfo'
                    }
                },
                { $unwind: '$workerInfo' },
                {
                    $group: {
                        _id: '$workerInfo.hostCountry',
                        totalWorkers: { $sum: 1 },
                        activeVisas: {
                            $sum: { $cond: [{ $eq: ['$visaStatus', 'ACTIVE'] }, 1, 0] }
                        },
                        expiring90Days: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$visaStatus', 'ACTIVE'] },
                                            { $lte: [{ $divide: [{ $subtract: ['$expirationDate', new Date()] }, 86400000] }, 90] },
                                            { $gt: [{ $divide: [{ $subtract: ['$expirationDate', new Date()] }, 86400000] }, 0] }
                                        ]
                                    },
                                    1, 0
                                ]
                            }
                        },
                        highRiskCases: {
                            $sum: { $cond: [{ $in: ['$riskLevel', ['HIGH', 'SEVERE']] }, 1, 0] }
                        },
                        totalLegalSpend: { $sum: '$legalFees.billed' }
                    }
                },
                { $sort: { highRiskCases: -1 } }
            ]);

            return riskData.map(r => ({
                country: r._id,
                totalWorkers: r.totalWorkers,
                activeVisas: r.activeVisas,
                expiringVisas: r.expiring90Days,
                riskIndex: r.highRiskCases,
                spend: r.totalLegalSpend
            }));
        } catch (error) {
            throw new Error(`Risk calculation failed: ${error.message}`);
        }
    }

    async seedMockData() {
        try {
            const workersExist = await ExpatWorker.countDocuments();
            if (workersExist > 0) return { message: 'Database already seeded with Immigration records.' };

            const countries = ['United States', 'United Kingdom', 'Germany', 'Singapore', 'Canada', 'Australia'];
            const depts = ['Engineering', 'Product', 'Sales', 'Legal', 'Operations'];
            const visaTypes = {
                'United States': ['H-1B', 'L-1', 'O-1'],
                'United Kingdom': ['Skilled Worker', 'Global Talent'],
                'Germany': ['EU Blue Card', 'Employment Visa'],
                'Singapore': ['Employment Pass', 'S Pass'],
                'Canada': ['Express Entry', 'ICT'],
                'Australia': ['TSS 482', 'ENS 186']
            };

            const workers = [];
            for (let i = 0; i < 50; i++) {
                const host = countries[Math.floor(Math.random() * countries.length)];
                const homeList = countries.filter(c => c !== host);
                const home = homeList[Math.floor(Math.random() * homeList.length)];

                workers.push(await ExpatWorker.create({
                    workerId: `EXPT-${Math.floor(Math.random() * 90000) + 10000}`,
                    fullName: `Worker ${uuidv4().substring(0, 6)}`,
                    homeCountry: home,
                    hostCountry: host,
                    department: depts[Math.floor(Math.random() * depts.length)],
                    jobTitle: 'Senior Specialist',
                    baseSalary: 90000 + (Math.random() * 80000)
                }));
            }

            for (let w of workers) {
                const types = visaTypes[w.hostCountry] || ['Work Permit'];
                const vType = types[Math.floor(Math.random() * types.length)];

                // Random days between -30 (expired) and +700 (safe)
                const daysToExpiry = Math.floor(Math.random() * 730) - 30;
                const expDate = new Date();
                expDate.setDate(expDate.getDate() + daysToExpiry);

                const issue = new Date(expDate);
                issue.setFullYear(issue.getFullYear() - 2);

                await VisaSponsorship.create({
                    sponsorshipId: `VISA-${uuidv4().substring(0, 8).toUpperCase()}`,
                    workerId: w._id,
                    visaType: vType,
                    sponsoringEntity: 'PaySphere Enterprise LLC',
                    issueDate: issue,
                    expirationDate: expDate,
                    renewalFilingDeadline: new Date(expDate.getTime() - (180 * 24 * 60 * 60 * 1000)),
                    legalFees: { billed: 5000 + (Math.random() * 10000), paid: 5000 },
                    documents: [
                        { docType: 'Passport', status: 'VERIFIED', uploadedAt: issue },
                        { docType: 'Offer Letter', status: 'VERIFIED', uploadedAt: issue }
                    ]
                });
            }

            return { message: 'Immigration data seeded successfully' };
        } catch (error) {
            throw new Error(`Seeding failed: ${error.message}`);
        }
    }
}

module.exports = new ImmigrationService();
