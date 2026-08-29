'use strict';
const { verifySeal } = require('../services/cryptographicSeal.service');
const logger = require('../utils/logger');

async function verifyDocumentSeal(req, res) {
  try {
    const { hash } = req.body;
    if (!hash || hash.trim() === '') {
      return res.status(400).json({ message: 'Document hash is required for verification.' });
    }

    const result = await verifySeal(hash);
    if (!result.verified) {
      return res.status(404).json({ verified: false, message: 'Document seal could not be verified or has been altered.' });
    }

    return res.json({
      verified: true,
      documentType: result.seal.documentType,
      createdAt: result.seal.createdAt,
      employeeName: result.seal.employeeId?.fullName,
      tenantName: result.seal.tenantId?.name,
    });
  } catch (err) {
    logger.error('verifyDocumentSeal controller error', { error: err.message });
    return res.status(500).json({ message: 'Internal server error during document verification.' });
  }
}

module.exports = { verifyDocumentSeal };