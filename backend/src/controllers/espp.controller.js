/**
 * ESPP Controller - Issue #1596
 */
'use strict';

const EsppEnrollment = require('../models/esppEnrollment.model');
const EsppTransaction = require('../models/esppTransaction.model');
const { calculatePurchaseMetrics, executeBatchPurchase } = require('../services/esppCalculator.service');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');

async function enrollEmployee(req, res) {
  try {
    const { employeeId, offeringPeriod, contributionPercent } = req.body;
    if (!employeeId || !offeringPeriod || !offeringPeriod.name || !offeringPeriod.grantPrice) {
      return res.status(400).json({ message: 'employeeId, offeringPeriod with name and grantPrice are required.' });
    }

    const enrollment = await EsppEnrollment.findOneAndUpdate(
      { tenantId: req.tenantId, employeeId, 'offeringPeriod.name': offeringPeriod.name },
      {
        $set: {
          offeringPeriod,
          contributionPercent: Math.min(15, Math.max(1, Number(contributionPercent) || 5)),
          status: 'active',
          createdBy: req.userId,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ message: 'Enrolled in ESPP successfully.', enrollment });
  } catch (err) {
    logger.error('enrollEmployee error', { error: err.message });
    return res.status(500).json({ message: 'Failed to enroll employee in ESPP.' });
  }
}

async function getEnrollments(req, res) {
  try {
    const filter = { ...tenantFilter(req) };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.offeringPeriodName) filter['offeringPeriod.name'] = req.query.offeringPeriodName;

    const enrollments = await EsppEnrollment.find(filter)
      .populate('employeeId', 'fullName email department')
      .sort('-createdAt')
      .lean();

    return res.json({ count: enrollments.length, enrollments });
  } catch (err) {
    logger.error('getEnrollments error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch ESPP enrollments.' });
  }
}

async function previewPurchase(req, res) {
  try {
    const { grantPrice, purchaseDatePrice, accumulatedFunds, discountPercent } = req.body;
    if (!grantPrice || !purchaseDatePrice || accumulatedFunds === undefined) {
      return res.status(400).json({ message: 'grantPrice, purchaseDatePrice, and accumulatedFunds are required.' });
    }

    const metrics = calculatePurchaseMetrics({
      grantPrice: Number(grantPrice),
      purchaseDatePrice: Number(purchaseDatePrice),
      accumulatedFunds: Number(accumulatedFunds),
      discountPercent: discountPercent !== undefined ? Number(discountPercent) : 15,
    });

    return res.json({ metrics });
  } catch (err) {
    logger.error('previewPurchase error', { error: err.message });
    return res.status(400).json({ message: err.message });
  }
}

async function runBatchPurchase(req, res) {
  try {
    const { offeringPeriodName, purchaseDatePrice, discountPercent } = req.body;
    if (!offeringPeriodName || !purchaseDatePrice) {
      return res.status(400).json({ message: 'offeringPeriodName and purchaseDatePrice are required.' });
    }

    const result = await executeBatchPurchase({
      tenantId: req.tenantId,
      offeringPeriodName,
      purchaseDatePrice: Number(purchaseDatePrice),
      discountPercent: discountPercent !== undefined ? Number(discountPercent) : 15,
    });

    return res.json({ message: 'ESPP Purchase execution run successfully.', ...result });
  } catch (err) {
    logger.error('runBatchPurchase error', { error: err.message });
    return res.status(500).json({ message: 'Failed to execute ESPP purchase run.' });
  }
}

async function getTransactions(req, res) {
  try {
    const filter = { ...tenantFilter(req) };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;

    const transactions = await EsppTransaction.find(filter)
      .populate('employeeId', 'fullName email')
      .sort('-purchaseDate')
      .lean();

    return res.json({ count: transactions.length, transactions });
  } catch (err) {
    logger.error('getTransactions error', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch ESPP transactions.' });
  }
}

module.exports = {
  enrollEmployee,
  getEnrollments,
  previewPurchase,
  runBatchPurchase,
  getTransactions,
};