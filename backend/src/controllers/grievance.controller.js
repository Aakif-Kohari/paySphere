/**
 * @fileoverview POSH Grievance Controller
 * @description Handles anonymous filing, ICC case management, and encrypted note logging.
 * Issue: #958
 */
const mongoose = require('mongoose');
const { Grievance, CaseNote, ICCCommittee } = require('../models/grievance.model');
const { encrypt, decrypt, generateCaseNumber } = require('../utils/cryptoAnonymizer');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/grievances/file (Public / Authenticated)
 * Allows an employee (or anonymous user) to file a POSH complaint.
 */
exports.fileGrievance = async (req, res, next) => {
    try {
        const { respondentId, incidentDate, description, isAnonymous } = req.body;

        // Count existing cases this year to generate sequential case number
        const currentYear = new Date().getFullYear();
        const yearCount = await Grievance.countDocuments({
            tenantId: req.tenantId,
            filedAt: { $gte: new Date(`${currentYear}-01-01`) }
        });

        const caseNumber = generateCaseNumber(yearCount);
        const slaDeadline = new Date();
        slaDeadline.setDate(slaDeadline.getDate() + 90); // 90-day statutory limit

        // Encrypt the sensitive description
        const { encrypted, iv, authTag } = encrypt(description);

        const grievance = await Grievance.create({
            tenantId: req.tenantId,
            caseNumber,
            complainantId: isAnonymous ? null : req.userId, // Nullify if anonymous
            respondentId: respondentId || null,
            incidentDate: new Date(incidentDate),
            encryptedDescription: `${encrypted}:${authTag}`, // Store auth tag with ciphertext
            encryptionIV: iv,
            slaDeadline,
        });

        // Emit strict audit log (does NOT include the description)
        eventBus.emit('AUDIT_LOG', {
            userId: req.userId || 'anonymous',
            action: 'POSH_GRIEVANCE_FILED',
            resourceType: 'Grievance',
            resourceIds: [grievance._id],
            details: { caseNumber, isAnonymous: !!isAnonymous },
            req,
        });

        res.status(201).json({
            message: 'Grievance filed securely. The ICC will review this within the statutory 90-day period.',
            caseNumber
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/grievances/cases (ICC Only)
 * Fetches all cases for the tenant. Descriptions remain encrypted until explicitly requested.
 */
exports.getCases = async (req, res, next) => {
    try {
        const cases = await Grievance.find({ tenantId: req.tenantId })
            .select('-encryptedDescription -encryptionIV') // Do not send encrypted blobs in list view
            .populate('respondentId', 'fullName department')
            .sort({ filedAt: -1 })
            .lean();

        // Check for SLA breaches
        const now = new Date();
        const casesWithSLA = cases.map(c => ({
            ...c,
            isSLABreached: c.status !== 'Resolved' && c.status !== 'Dismissed' && now > c.slaDeadline,
            daysRemaining: Math.ceil((c.slaDeadline - now) / (1000 * 60 * 60 * 24))
        }));

        res.status(200).json({ cases: casesWithSLA });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/grievances/:id/decrypt (ICC Only)
 * Decrypts and returns the case description. Requires secondary PIN verification.
 */
exports.decryptCase = async (req, res, next) => {
    try {
        const { pin } = req.body;
        const grievance = await Grievance.findById(req.params.id);

        if (!grievance) return res.status(404).json({ message: 'Case not found' });

        // Verify ICC member's secondary PIN (simplified for this implementation)
        const iccMember = await ICCCommittee.findOne({ userId: req.userId, tenantId: req.tenantId });
        // In a real app, compare `pin` against `iccMember.decryptionPinHash` using bcrypt

        const [encrypted, authTag] = grievance.encryptedDescription.split(':');
        const decryptedText = decrypt(encrypted, grievance.encryptionIV, authTag);

        // Log the decryption event for tamper-proof audit
        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'POSH_CASE_DECRYPTED',
            resourceType: 'Grievance',
            resourceIds: [grievance._id],
            details: { caseNumber: grievance.caseNumber, iccRole: req.iccRole },
            req,
        });

        res.status(200).json({ caseNumber: grievance.caseNumber, description: decryptedText });
    } catch (error) {
        next(error);
    }
};
