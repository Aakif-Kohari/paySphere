const FbpService = require('../services/fbp.service');

exports.createWindow = async (req, res, next) => {
  try {
    const { tenantId, userId } = req;
    const configData = req.body;
    const window = await FbpService.createWindow(tenantId, userId, configData);
    res.status(201).json({ success: true, data: window });
  } catch (error) {
    next(error);
  }
};

exports.getOpenWindows = async (req, res, next) => {
  try {
    const { tenantId } = req;
    const windows = await FbpService.getOpenWindows(tenantId);
    res.status(200).json({ success: true, data: windows });
  } catch (error) {
    next(error);
  }
};

exports.simulateTaxImpact = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { proposedComponents } = req.body;
    const simulation = await FbpService.simulateTaxImpact(
      employeeId,
      proposedComponents,
    );
    res.status(200).json({ success: true, data: simulation });
  } catch (error) {
    next(error);
  }
};

exports.submitDeclaration = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { fbpConfigId, proposedComponents } = req.body;
    const declaration = await FbpService.submitDeclaration(
      employeeId,
      fbpConfigId,
      proposedComponents,
    );
    res.status(201).json({ success: true, data: declaration });
  } catch (error) {
    next(error);
  }
};

exports.approveDeclaration = async (req, res, next) => {
  try {
    const { declarationId } = req.params;
    const { userId } = req;
    const declaration = await FbpService.approveDeclaration(
      declarationId,
      userId,
    );
    res.status(200).json({ success: true, data: declaration });
  } catch (error) {
    next(error);
  }
};

exports.rejectDeclaration = async (req, res, next) => {
  try {
    const { declarationId } = req.params;
    const { userId } = req;
    const { reason } = req.body;
    const declaration = await FbpService.rejectDeclaration(
      declarationId,
      userId,
      reason,
    );
    res.status(200).json({ success: true, data: declaration });
  } catch (error) {
    next(error);
  }
};
