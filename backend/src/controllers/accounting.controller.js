/**
 * @fileoverview Accounting & ERP Export Controller
 * @description Manages GL mappings, generates double-entry journals from finalized payroll,
 * and exports to Tally XML or generic CSV.
 * Issue: #986
 */
const mongoose = require('mongoose');
const { GLAccountMapping, JournalVoucher } = require('../models/journalEntry.model');
const PayrollUpdate = require('../models/payroll.model');
const { generateJournalLegs } = require('../utils/journalGenerator');
const { generateTallyXml, generateGenericCsv } = require('../utils/tallyXmlExporter');
const logger = require('../utils/logger');

/**
 * GET /api/accounting/mappings
 * Fetch GL mappings for the tenant.
 */
exports.getMappings = async (req, res, next) => {
    try {
        const mappings = await GLAccountMapping.find({ tenantId: req.tenantId });
        res.status(200).json({ mappings });
    } catch (error) { next(error); }
};

/**
 * POST /api/accounting/mappings
 * Bulk update GL mappings.
 */
exports.updateMappings = async (req, res, next) => {
    try {
        const { mappings } = req.body; // Array of { componentKey, glAccountName, glAccountCode, nature }

        // Delete existing and insert new (simplest bulk upsert strategy for settings)
        await GLAccountMapping.deleteMany({ tenantId: req.tenantId });

        const toInsert = mappings.map(m => ({
            tenantId: req.tenantId,
            componentKey: m.componentKey,
            glAccountName: m.glAccountName,
            glAccountCode: m.glAccountCode || '',
            nature: m.nature
        }));

        await GLAccountMapping.insertMany(toInsert);
        res.status(200).json({ message: 'GL mappings updated successfully' });
    } catch (error) { next(error); }
};

/**
 * POST /api/accounting/generate-journal
 * Generates a double-entry journal voucher for a specific payroll month.
 */
exports.generateJournal = async (req, res, next) => {
    try {
        const { month, year } = req.body;

        // Check if journal already exists for this month
        const existing = await JournalVoucher.findOne({ tenantId: req.tenantId, month, year });
        if (existing) {
            return res.status(409).json({ message: 'Journal voucher already generated for this month. Delete it first to regenerate.' });
        }

        // Fetch finalized/paid payrolls
        const payrolls = await PayrollUpdate.find({
            tenantId: req.tenantId,
            month,
            year,
            status: { $in: ['approved', 'paid'] }
        }).lean();

        if (payrolls.length === 0) {
            return res.status(400).json({ message: 'No approved/paid payroll records found for this month.' });
        }

        const mappings = await GLAccountMapping.find({ tenantId: req.tenantId });
        if (mappings.length === 0) {
            return res.status(400).json({ message: 'GL mappings not configured. Please map payroll components to GL accounts first.' });
        }

        const voucherNumber = `JV/PAY/${year}/${String(month).padStart(2, '0')}`;
        const voucherDate = new Date(year, month - 1, new Date(year, month, 0).getDate()); // Last day of the month

        const { legs, totalDebit, totalCredit, isBalanced } = generateJournalLegs(payrolls, mappings, voucherNumber, voucherDate);

        if (!isBalanced) {
            logger.warn('Generated unbalanced journal voucher', { tenantId: req.tenantId, month, year, totalDebit, totalCredit });
        }

        const voucher = await JournalVoucher.create({
            tenantId: req.tenantId,
            month,
            year,
            voucherNumber,
            voucherDate,
            legs,
            totalDebit,
            totalCredit,
            isBalanced,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'Journal voucher generated', voucher });
    } catch (error) { next(error); }
};

/**
 * GET /api/accounting/export/:id/tally
 * Downloads the Tally TDL9 XML file for a specific journal voucher.
 */
exports.exportTallyXml = async (req, res, next) => {
    try {
        const voucher = await JournalVoucher.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!voucher) return res.status(404).json({ message: 'Journal voucher not found' });

        const xml = generateTallyXml(voucher);

        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=${voucher.voucherNumber.replace(/\//g, '-')}-Tally.xml`);
        res.status(200).send(xml);

        // Mark as exported
        voucher.exportedToERP = true;
        await voucher.save();
    } catch (error) { next(error); }
};

/**
 * GET /api/accounting/export/:id/csv
 * Downloads generic ERP CSV for a specific journal voucher.
 */
exports.exportCsv = async (req, res, next) => {
    try {
        const voucher = await JournalVoucher.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!voucher) return res.status(404).json({ message: 'Journal voucher not found' });

        const csv = generateGenericCsv(voucher);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${voucher.voucherNumber.replace(/\//g, '-')}-ERP.csv`);
        res.status(200).send(csv);
    } catch (error) { next(error); }
};
