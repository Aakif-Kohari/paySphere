const successionService = require('../services/successionService');
const { asyncHandler } = require('../middleware/async');

exports.getRoles = asyncHandler(async (req, res) => {
    const data = await successionService.getRoles(req.query);
    res.status(200).json({ success: true, count: data.length, data });
});

exports.getCandidates = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, ...filters } = req.query;
    const result = await successionService.getCandidates(page, limit, filters);
    res.status(200).json({ success: true, ...result });
});

exports.getTopology = asyncHandler(async (req, res) => {
    const data = await successionService.calculateFlightRiskTopology();
    res.status(200).json({ success: true, count: data.length, data });
});

exports.seedSuccessionData = asyncHandler(async (req, res) => {
    const result = await successionService.seedMockData();
    res.status(201).json({ success: true, ...result });
});
