const payEquityService = require('../services/payEquityService');

class PayEquityController {

  /**
   * Triggers a new compensation audit
   * POST /api/v1/admin/pay-equity/audit
   */
  async runAudit(req, res) {
    try {
      const auditorId = req.user ? req.user.id : 'ADMIN_SYSTEM';
      const auditLog = await payEquityService.runCompensationAudit(auditorId);

      return res.status(201).json({
        success: true,
        message: 'Pay Parity Audit successfully generated.',
        data: auditLog
      });
    } catch (error) {
      console.error('Error running compensation audit:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Retrieves data for the interactive parity scatter plot
   * GET /api/v1/admin/pay-equity/scatter
   */
  async getScatterData(req, res) {
    try {
      const { department } = req.query;
      const scatterData = await payEquityService.getScatterPlotParityData(department);

      return res.status(200).json({
        success: true,
        data: scatterData
      });
    } catch (error) {
      console.error('Error fetching parity scatter data:', error);
      return res.status(500).json({ success: false, error: 'Database access failed for scatter plot.' });
    }
  }

  /**
   * Calculates required budget to remediate pay gap issues
   * POST /api/v1/admin/pay-equity/audit/:auditId/remediation
   */
  async calculateRemediation(req, res) {
    try {
      const { auditId } = req.params;
      const remediationData = await payEquityService.calculateRemediationBudget(auditId);

      return res.status(200).json({
        success: true,
        data: remediationData
      });
    } catch (error) {
      console.error('Error calculating remediation:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * Fetches latest top 10 historical parity audits
   * GET /api/v1/admin/pay-equity/history
   */
  async getHistory(req, res) {
    try {
      const history = await payEquityService.getAuditHistory();
      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error retrieving audit history:', error);
      return res.status(500).json({ success: false, error: 'Could not fetch history.' });
    }
  }

  /**
   * Seeds demo data
   * POST /api/v1/admin/pay-equity/seed
   */
  async seed(req, res) {
    try {
      const result = await payEquityService.seedEquityData();
      return res.status(201).json({
        success: true,
        message: 'Database seeded successfully',
        data: result
      });
    } catch (error) {
      console.error('Error seeding data:', error);
      return res.status(500).json({ success: false, error: 'Data seeding failed.' });
    }
  }
}

module.exports = new PayEquityController();
