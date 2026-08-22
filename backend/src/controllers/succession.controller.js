const successionService = require('../services/successionService');
const { TalentProfile, SuccessionPlan } = require('../models/SuccessionModels');

class SuccessionController {

    /**
     * Generate and fetch the 9-box matrix grouped by employee
     */
    async getTalentMatrix(req, res) {
        try {
            const { department } = req.query;
            const matrixData = await successionService.generateTalentMatrix(department);
            return res.status(200).json({
                success: true,
                data: matrixData
            });
        } catch (error) {
            console.error('Error fetching talent matrix:', error);
            return res.status(500).json({ success: false, error: 'Failed to construct Talent Matrix.' });
        }
    }

    /**
     * Get flight risk top offenders
     */
    async getFlightRiskTopology(req, res) {
        try {
            const { threshold } = req.query;
            const riskThreshold = threshold ? parseInt(threshold, 10) : 70;
            const topology = await successionService.getFlightRiskTopology(riskThreshold);

            return res.status(200).json({
                success: true,
                data: topology
            });
        } catch (error) {
            console.error('Error computing flight risk topology:', error);
            return res.status(500).json({ success: false, error: 'Failed to construct Topology.' });
        }
    }

    /**
     * Get overall dashboard metrics for succession planning
     */
    async getDashboardSummary(req, res) {
        try {
            const summary = await successionService.getDashboardSummary();
            return res.status(200).json({
                success: true,
                data: summary
            });
        } catch (error) {
            console.error('Error in dashboard summary:', error);
            return res.status(500).json({ success: false, error: 'Failed to retrieve dashboard summary.' });
        }
    }

    /**
     * Auto suggest candidates for a succession plan
     */
    async suggestCandidates(req, res) {
        try {
            const { targetRoleId } = req.params;
            const suggestions = await successionService.autoSuggestSuccessors(targetRoleId);
            return res.status(200).json({
                success: true,
                data: suggestions
            });
        } catch (error) {
            console.error('Error in suggest candidates:', error);
            return res.status(400).json({ success: false, error: error.message || 'Failed to suggest candidates.' });
        }
    }

    /**
     * Create or update a succession plan
     */
    async upsertSuccessionPlan(req, res) {
        try {
            const { targetRoleId, targetRoleName, department, candidates, status } = req.body;
            const userId = req.user ? req.user.id : 'SYSTEM'; // mocking auth

            const plan = await SuccessionPlan.findOneAndUpdate(
                { targetRoleId },
                {
                    targetRoleName,
                    department,
                    candidates,
                    status,
                    createdBy: userId,
                    lastReviewedDate: new Date()
                },
                { new: true, upsert: true }
            );

            return res.status(200).json({
                success: true,
                data: plan
            });
        } catch (error) {
            console.error('Error upserting plan:', error);
            return res.status(500).json({ success: false, error: 'Could not save succession plan.' });
        }
    }

    /**
     * Utility endpoint to seed data for demonstration
     */
    async seedData(req, res) {
        try {
            const seedResult = await successionService.seedDemoData();
            return res.status(201).json({
                success: true,
                data: seedResult
            });
        } catch (error) {
            console.error('Seeding error:', error);
            return res.status(500).json({ success: false, error: 'Database seeding failed.' });
        }
    }
}

module.exports = new SuccessionController();
