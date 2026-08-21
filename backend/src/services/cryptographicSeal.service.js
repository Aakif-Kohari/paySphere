'use strict';
const crypto = require('crypto');
const DocumentSeal = require('../models/documentSeal.model');
const logger = require('../utils/logger');

function generateSealSignature(hash, secret) {
  return crypto.createHmac('sha256', secret).update(hash).digest('base64');
}

async function sealDocument({ tenantId, employeeId, documentType, documentContent, signedBy }) {
  try {
    const hash = crypto.createHash('sha256').update(documentContent).digest('hex');
    const secretKey = process.env.CRYPTO_SEAL_SECRET || tenantId.toString();
    const signature = generateSealSignature(hash, secretKey);

    const seal = await DocumentSeal.create({
      tenantId,
      employeeId,
      documentType,
      documentHash: hash,
      signedBy,
      signature,
    });

    logger.info('Document sealed successfully', { tenantId, employeeId, hash });
    return seal;
  } catch (err) {
    logger.error('Failed to seal document', { error: err.message });
    throw err;
  }
}

async function verifySeal(hash) {
  const seal = await DocumentSeal.findOne({ documentHash: hash })
    .populate('employeeId', 'fullName email')
    .populate('tenantId', 'name');

  if (!seal) return { verified: false };

  const secretKey = process.env.CRYPTO_SEAL_SECRET || seal.tenantId._id.toString();
  const expectedSignature = generateSealSignature(hash, secretKey);
  const isValid = seal.signature === expectedSignature;

  return {
    verified: isValid,
    seal,
  };
}

module.exports = { sealDocument, verifySeal };