const PayrollComparisonService = require('../services/payrollComparison.service');

exports.comparePayrolls = async (req, res) => {
  try {
    const { monthA, yearA, monthB, yearB } = req.query;
    
    // In a multi-tenant setup, tenantId would be inferred from req.user
    const tenantId = req.user?.tenantId || req.tenantId;

    if (!tenantId) {
       return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (!monthA || !yearA || !monthB || !yearB) {
      return res.status(400).json({ success: false, message: 'Missing required query parameters: monthA, yearA, monthB, yearB' });
    }

    const comparisonData = await PayrollComparisonService.comparePayrolls(
      tenantId,
      parseInt(monthA, 10),
      parseInt(yearA, 10),
      parseInt(monthB, 10),
      parseInt(yearB, 10)
    );

    res.status(200).json({
      success: true,
      data: comparisonData
    });
  } catch (error) {
    console.error('Error comparing payrolls:', error);
    res.status(500).json({ success: false, message: 'Failed to compare payrolls', error: error.message });
  }
};
