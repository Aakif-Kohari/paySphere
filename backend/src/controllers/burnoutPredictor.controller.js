const burnoutService = require('../services/burnoutPredictorService');
const { WellnessInterventionLog } = require('../models/BurnoutRiskModels');

class BurnoutPredictorController {

    /**
     * Retrieves department aggregated heatmap data
     */
    async getDepartmentHeatmap(req, res) {
        try {
            const data = await burnoutService.getDepartmentHeatmapData();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Heatmap error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate heatmap.' });
        }
    }

    /**
     * Retrieves all high-risk employees
     */
    async getHighRiskTopology(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const data = await burnoutService.getHighRiskTopology(limit);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Risk topology error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate topology.' });
        }
    }

    /**
     * AI Job: Auto-generates proactive wellness interventions for critical individuals
     */
    async runAutoInterventionBatch(req, res) {
        try {
            const interventions = await burnoutService.autoGenerateInterventions();
            return res.status(201).json({
                success: true,
                message: 'Auto-intervention batch completed',
                count: interventions.length,
                data: interventions
            });
        } catch (error) {
            console.error('Auto intervention error:', error);
            return res.status(500).json({ success: false, error: 'Failed to run intervention batch.' });
        }
    }

    /**
     * Retrieves currently active or proposed wellness interventions
     */
    async getActiveInterventions(req, res) {
        try {
            const active = await WellnessInterventionLog.find({
                status: { $in: ['PROPOSED', 'ACTIVE'] }
            }).limit(50).lean();

            return res.status(200).json({ success: true, data: active });
        } catch (error) {
            console.error('Fetch active interventions error:', error);
            return res.status(500).json({ success: false, error: 'Failed to retrieve active interventions.' });
        }
    }

    /**
     * Seeds demo data
     */
    async seedDemoData(req, res) {
        try {
            const result = await burnoutService.seedDemoData();
            return res.status(201).json({ success: true, message: 'Seeded', data: result });
        } catch (error) {
            console.error('Seed error:', error);
            return res.status(500).json({ success: false, error: 'Failed to seed data.' });
        }
    }
}

module.exports = new BurnoutPredictorController();
