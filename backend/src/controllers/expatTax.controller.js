const expatTaxService = require('../services/expatTaxService');

class ExpatTaxController {

    /**
     * Retrieves enterprise global mobility overview
     */
    async getMobilitySummary(req, res) {
        try {
            const summary = await expatTaxService.getEnterpriseMobilitySummary();
            return res.status(200).json({ success: true, data: summary });
        } catch (error) {
            console.error('Mobility Summary Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate mobility summary.' });
        }
    }

    /**
     * Retrieves paginated high tax liability expats
     */
    async getHighCostAssignments(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const assignments = await expatTaxService.getHighCostAssignments(limit);
            return res.status(200).json({ success: true, data: assignments });
        } catch (error) {
            console.error('High Cost Assignment Error:', error);
            return res.status(500).json({ success: false, error: 'Failed to fetch high-cost expat assignments.' });
        }
    }

    /**
     * Seed expat mocked database
     */
    async seedData(req, res) {
        try {
            const result = await expatTaxService.seedDemoData();
            return res.status(201).json({ success: true, message: 'Global Mobility seeded successfully', data: result });
        } catch (error) {
            console.error('Seed error:', error);
            return res.status(500).json({ success: false, error: 'Failed to seed global mobility data.' });
        }
    }
}

module.exports = new ExpatTaxController();
