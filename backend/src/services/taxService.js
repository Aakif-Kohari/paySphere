const { TaxJurisdiction, CorporateObligation } = require('../models/TaxModels');
const { v4: uuidv4 } = require('uuid');

class TaxService {
    async getJurisdictions(query = {}) {
        try {
            const matchStage = {};
            if (query.region) matchStage.region = query.region;
            if (query.status) matchStage.complianceStatus = query.status;

            return await TaxJurisdiction.find(matchStage).sort({ 'metadata.complexityScore': -1 });
        } catch (error) {
            throw new Error(`Failed to fetch tax jurisdictions: ${error.message}`);
        }
    }

    async getObligations(page = 1, limit = 50, filters = {}) {
        try {
            const skip = (page - 1) * limit;
            const matchStage = {};

            if (filters.status) matchStage.status = filters.status;
            if (filters.jurisdictionId) matchStage.jurisdictionId = filters.jurisdictionId;

            const obligations = await CorporateObligation.find(matchStage)
                .populate('jurisdictionId')
                .sort({ periodEnd: -1 })
                .skip(skip)
                .limit(limit);

            const total = await CorporateObligation.countDocuments(matchStage);

            return {
                data: obligations,
                pagination: {
                    total,
                    page: Number(page),
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new Error(`Failed to fetch corporate obligations: ${error.message}`);
        }
    }

    async calculateRiskTopology() {
        try {
            // Massive aggregation to construct node clusters for frontend Recharts topology
            const topology = await TaxJurisdiction.aggregate([
                {
                    $lookup: {
                        from: 'corporateobligations',
                        localField: '_id',
                        foreignField: 'jurisdictionId',
                        as: 'obligations'
                    }
                },
                {
                    $project: {
                        jurisdictionCode: 1,
                        country: 1,
                        region: 1,
                        complexity: '$metadata.complexityScore',
                        taxRates: 1,
                        complianceStatus: 1,
                        totalLiability: { $sum: '$obligations.taxLiabilities.totalLiability' },
                        outstandingBalance: { $sum: '$obligations.taxLiabilities.outstandingBalance' },
                        riskMetrics: {
                            highRiskFlags: {
                                $sum: {
                                    $size: {
                                        $filter: {
                                            input: { $reduce: { input: '$obligations.riskFlags', initialValue: [], in: { $concatArrays: ['$$value', '$$this'] } } },
                                            as: 'flag',
                                            cond: { $in: ['$$flag.severity', ['HIGH', 'CRITICAL']] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$region',
                        nodes: {
                            $push: {
                                id: '$jurisdictionCode',
                                name: '$country',
                                complexity: '$complexity',
                                taxRate: '$taxRates.corporateTax',
                                liability: '$totalLiability',
                                risk: '$riskMetrics.highRiskFlags',
                                status: '$complianceStatus'
                            }
                        },
                        regionalLiability: { $sum: '$totalLiability' },
                        regionalRisk: { $sum: '$riskMetrics.highRiskFlags' }
                    }
                }
            ]);

            return topology.map(region => ({
                region: region._id || 'Global',
                nodes: region.nodes,
                metrics: {
                    aggregateLiability: region.regionalLiability,
                    aggregateRisk: region.regionalRisk
                }
            }));
        } catch (error) {
            throw new Error(`Topology calculation failed: ${error.message}`);
        }
    }

    async seedMockData() {
        try {
            const jurisdictionsExist = await TaxJurisdiction.countDocuments();
            if (jurisdictionsExist > 0) return { message: 'Database already seeded with Tax structures.' };

            const jurisdictions = [
                { code: 'US-FED', country: 'United States', region: 'North America', cT: 0.21, pE: 0.0765, cp: 85, st: 'HARMONIZED' },
                { code: 'UK-HMRC', country: 'United Kingdom', region: 'Europe', cT: 0.25, pE: 0.138, cp: 75, st: 'AT_RISK' },
                { code: 'SG-IRAS', country: 'Singapore', region: 'Asia Pacific', cT: 0.17, pE: 0.17, cp: 30, st: 'HARMONIZED' },
                { code: 'BR-RFB', country: 'Brazil', region: 'South America', cT: 0.34, pE: 0.20, cp: 95, st: 'NON_COMPLIANT' },
                { code: 'DE-BMF', country: 'Germany', region: 'Europe', cT: 0.15, pE: 0.19, cp: 80, st: 'AUDIT_PENDING' }
            ];

            const savedJurisdictions = [];
            for (const j of jurisdictions) {
                const doc = await TaxJurisdiction.create({
                    jurisdictionCode: j.code,
                    country: j.country,
                    region: j.region,
                    regulatoryBody: `Ministry of Finance - ${j.country}`,
                    taxRates: {
                        corporateTax: j.cT,
                        payrollTaxEmployer: j.pE,
                        payrollTaxEmployee: j.pE
                    },
                    complianceStatus: j.st,
                    metadata: { complexityScore: j.cp, filingFrequency: 'QUARTERLY' }
                });
                savedJurisdictions.push(doc);
            }

            const statuses = ['DRAFT', 'FILED', 'PAID', 'OVERDUE', 'DISPUTED'];

            for (let i = 0; i < 200; i++) {
                const jur = savedJurisdictions[Math.floor(Math.random() * savedJurisdictions.length)];
                const gross = 500000 + Math.random() * 5000000;
                const ded = gross * (0.2 + Math.random() * 0.4);
                const net = gross - ded;
                const payroll = gross * (0.1 + Math.random() * 0.3);
                const cTax = net * jur.taxRates.corporateTax;
                const pTax = payroll * jur.taxRates.payrollTaxEmployer;
                const tot = cTax + pTax;

                const stat = statuses[Math.floor(Math.random() * statuses.length)];
                const paid = stat === 'PAID' ? tot : (stat === 'FILED' ? tot * 0.5 : 0);

                await CorporateObligation.create({
                    obligationId: `TAX-OBL-${uuidv4().substring(0, 8).toUpperCase()}`,
                    jurisdictionId: jur._id,
                    periodStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                    financialMetrics: { grossRevenue: gross, deductibleExpenses: ded, netTaxableIncome: net, payrollTotal: payroll },
                    taxLiabilities: { calculatedCorporateTax: cTax, calculatedPayrollTax: pTax, totalLiability: tot, paidAmount: paid, outstandingBalance: tot - paid },
                    status: stat,
                    riskFlags: stat === 'OVERDUE' || stat === 'DISPUTED' ? [{ flagType: 'PAYMENT_DELAY', severity: 'HIGH', description: 'Obligation missed filing deadline' }] : []
                });
            }

            return { message: 'Tax harmonization data seeded successfully' };
        } catch (error) {
            throw new Error(`Seeding failed: ${error.message}`);
        }
    }
}

module.exports = new TaxService();
