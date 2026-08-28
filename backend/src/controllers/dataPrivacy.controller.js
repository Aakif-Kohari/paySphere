/**
 * @fileoverview Data Privacy Controller
 * @description Manages PII masking rules, consent workflows, erasure requests, and audit logs.
 * Issue: #1870
 */
const mongoose = require('mongoose');
const { PrivacyConsent, PIIMaskingRule, DataErasureRequest, DataAuditLog } = require('../models/dataPrivacy.model');
const Employee = require('../models/employee.model'); // Assuming exists
const { applyDynamicMasking, executeSafeErasure } = require('../utils/piiMaskingEngine.utils');
const logger = require('../utils/logger');

exports.createMaskingRule = async (req, res, next) => {
    try {
        const rule = await PIIMaskingRule.findOneAndUpdate(
            { tenantId: req.tenantId, fieldName: req.body.fieldName },
            { ...req.body, tenantId: req.tenantId },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Masking rule saved', rule });
    } catch (error) { next(error); }
};

exports.recordConsent = async (req, res, next) => {
    try {
        const { employeeId, consentType, isGranted, consentVersion } = req.body;

        const updateData = {
            tenantId: req.tenantId, employeeId, consentType,
            isGranted, consentVersion, ipAddress: req.ip, userAgent: req.headers['user-agent']
        };

        if (isGranted) {
            updateData.grantedAt = new Date();
            updateData.revokedAt = null;
        } else {
            updateData.revokedAt = new Date();
        }

        const consent = await PrivacyConsent.findOneAndUpdate(
            { tenantId: req.tenantId, employeeId, consentType },
            updateData,
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Consent recorded', consent });
    } catch (error) { next(error); }
};

exports.requestErasure = async (req, res, next) => {
    try {
        const { employeeId, requestType } = req.body;

        const request = await DataErasureRequest.create({
            tenantId: req.tenantId, employeeId, requestType, requestedBy: req.userId,
            hasLegalHold: true // Default to true until compliance officer reviews
        });

        res.status(201).json({ message: 'Erasure request submitted', request });
    } catch (error) { next(error); }
};

exports.processErasure = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { requestId, approve } = req.body;
        const request = await DataErasureRequest.findById(requestId).session(session);
        if (!request) throw new Error('Request not found');

        if (!approve) {
            request.status = 'Rejected (Legal Hold)';
            await request.save({ session });
            await session.commitTransaction();
            return res.status(200).json({ message: 'Request rejected due to legal hold.' });
        }

        // Execute Safe Erasure
        const employee = await Employee.findById(request.employeeId).session(session);
        if (!employee) throw new Error('Employee not found');

        const anonymizedData = executeSafeErasure(employee.toObject());

        // Update employee record with anonymized data
        await Employee.findByIdAndUpdate(request.employeeId, anonymizedData, { session });

        request.status = 'Completed';
        request.anonymizedAt = new Date();
        request.processedBy = req.userId;
        await request.save({ session });

        // Log the erasure
        await DataAuditLog.create([{
            tenantId: req.tenantId, userId: req.userId, userRole: 'ComplianceAdmin',
            action: 'Executed Erasure', targetEmployeeId: request.employeeId,
            fieldsAccessed: ['firstName', 'lastName', 'ssn', 'homeAddress'],
            ipAddress: req.ip, wasMasked: false
        }], { session });

        await session.commitTransaction();
        logger.info(`[Privacy] Executed GDPR erasure for employee ${request.employeeId}`);
        res.status(200).json({ message: 'PII successfully anonymized. Financial records preserved.' });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

exports.getMaskedEmployeeData = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const employee = await Employee.findById(employeeId);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const rules = await PIIMaskingRule.find({ tenantId: req.tenantId, isActive: true });

        // Mocking user roles from the auth middleware
        const userRoles = req.userRoles || ['StandardUser'];

        const { maskedData, accessedFields, wasMasked } = applyDynamicMasking(employee.toObject(), rules, userRoles);

        // Log the access
        if (accessedFields.length > 0) {
            await DataAuditLog.create({
                tenantId: req.tenantId, userId: req.userId, userRole: userRoles[0] || 'Unknown',
                action: 'Viewed PII', targetEmployeeId: employeeId,
                fieldsAccessed: accessedFields, ipAddress: req.ip, wasMasked
            });
        }

        res.status(200).json({ data: maskedData, wasMasked });
    } catch (error) { next(error); }
};

exports.getDashboard = async (req, res, next) => {
    try {
        const rules = await PIIMaskingRule.find({ tenantId: req.tenantId }).sort({ fieldName: 1 });
        const pendingErasure = await DataErasureRequest.find({ tenantId: req.tenantId, status: 'Pending Review' })
            .populate('employeeId', 'fullName');
        const recentLogs = await DataAuditLog.find({ tenantId: req.tenantId })
            .populate('userId', 'fullName')
            .sort({ createdAt: -1 }).limit(50);

        res.status(200).json({ rules, pendingErasure, recentLogs });
    } catch (error) { next(error); }
};
