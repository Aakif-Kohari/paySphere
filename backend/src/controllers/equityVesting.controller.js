const equityVestingService = require('../services/equityVestingService');

class EquityVestingController {

    /**
     * Gets the overall enterprise liability summary for unvested shares
     */
    async getEnterpriseSummary(req, res) {
        try {
            const summary = await equityVestingService.getEnterpriseLiabilitySummary();
            return res.status(200).json({ success: true, data: summary });
        } catch (error) {
            console.error('Enterprise Summary Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate enterprise equity summary.' });
        }
    }

    /**
     * Gets portfolio for single employee
     */
    async getEmployeePortfolio(req, res) {
        try {
            const { employeeId } = req.params;
            const portfolio = await equityVestingService.getEmployeeEquityPortfolio(employeeId);
            return res.status(200).json({ success: true, data: portfolio });
        } catch (error) {
            console.error('Portfolio Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch employee portfolio.' });
        }
    }

    /**
     * Retrieves top individuals with highest unvested value
     */
    async getTopHolders(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const holders = await equityVestingService.getTopEquityHolders(limit);
            return res.status(200).json({ success: true, data: holders });
        } catch (error) {
            console.error('Top Holders Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to retrieve top holders.' });
        }
    }

    /**
     * Seed Mock Database
     */
    async seedData(req, res) {
        try {
            const result = await equityVestingService.seedEquityData();
            return res.status(201).json({ success: true, message: 'Equity system seeded successfully', data: result });
        } catch (error) {
            console.error('Seed error:', error);
            return res.status(500).json({ success: false, error: 'Failed to seed equity data.' });
        }
    }
}

module.exports = new EquityVestingController();
