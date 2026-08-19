/**
 * @fileoverview Handover Controller
 * @description Manages the lifecycle of offboarding plans, knowledge transfers, 
 * asset recoveries, and manager/IT sign-offs.
 * Issue: #1205
 */
const { HandoverPlan } = require('../models/handover.model');
const Employee = require('../models/employee.model');
const {
    generateAccessRevocationChecklist,
    calculateClearanceScore,
    checkFnFBlock
} = require('../utils/handoverEngine.utils');
const logger = require('../utils/logger');

exports.initiateHandover = async (req, res, next) => {
    try {
        const { employeeId, exitDate } = req.body;
        const employee = await Employee.findOne({ _id: employeeId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Generate IT access checklist based on department/role
        const accessChecklist = generateAccessRevocationChecklist(employee.department, employee.role);

        const plan = await HandoverPlan.create({
            tenantId: req.tenantId,
            employeeId: employee._id,
            exitDate: new Date(exitDate),
            accessRevocations: accessChecklist,
            status: 'In Progress'
        });

        res.status(201).json({ message: 'Handover plan initiated', plan });
    } catch (error) { next(error); }
};

exports.updateKnowledgeTransfer = async (req, res, next) => {
    try {
        const { planId, ktId, isCompleted, link, attachmentUrl } = req.body;
        const plan = await HandoverPlan.findOne({ _id: planId, tenantId: req.tenantId });
        if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

        const kt = plan.knowledgeTransfers.id(ktId);
        if (!kt) return res.status(404).json({ message: 'Knowledge transfer item not found' });

        if (isCompleted !== undefined) {
            kt.isCompleted = isCompleted;
            kt.completedAt = isCompleted ? new Date() : null;
        }
        if (link) kt.link = link;
        if (attachmentUrl) kt.attachmentUrl = attachmentUrl;

        // Recalculate score
        plan.clearanceScore = calculateClearanceScore(plan);
        const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
        plan.isFnFBlocked = blockCheck.isBlocked;

        await plan.save();
        res.status(200).json({ message: 'Knowledge transfer updated', plan });
    } catch (error) { next(error); }
};

exports.updateAssetRecovery = async (req, res, next) => {
    try {
        const { planId, assetId, condition, recoveryNotes, payrollDeduction } = req.body;
        const plan = await HandoverPlan.findOne({ _id: planId, tenantId: req.tenantId });
        if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

        const asset = plan.assetRecoveries.id(assetId);
        if (!asset) return res.status(404).json({ message: 'Asset not found' });

        asset.condition = condition;
        asset.recoveryNotes = recoveryNotes || asset.recoveryNotes;
        asset.payrollDeduction = payrollDeduction || 0;
        if (condition !== 'Pending Return') asset.recoveredAt = new Date();

        plan.clearanceScore = calculateClearanceScore(plan);
        const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
        plan.isFnFBlocked = blockCheck.isBlocked;

        await plan.save();
        res.status(200).json({ message: 'Asset recovery updated', plan });
    } catch (error) { next(error); }
};

exports.revokeAccess = async (req, res, next) => {
    try {
        const { planId, accessId } = req.body;
        const plan = await HandoverPlan.findOne({ _id: planId, tenantId: req.tenantId });
        if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

        const access = plan.accessRevocations.id(accessId);
        if (!access) return res.status(404).json({ message: 'Access item not found' });

        access.isRevoked = true;
        access.revokedAt = new Date();
        access.revokedBy = req.userId;

        plan.clearanceScore = calculateClearanceScore(plan);
        plan.itSignOff = plan.accessRevocations.every(a => a.isRevoked);
        if (plan.itSignOff) plan.itSignOffDate = new Date();

        const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
        plan.isFnFBlocked = blockCheck.isBlocked;

        if (!plan.isFnFBlocked) plan.status = 'Cleared';

        await plan.save();
        res.status(200).json({ message: 'Access revoked', plan });
    } catch (error) { next(error); }
};

exports.managerSignOff = async (req, res, next) => {
    try {
        const { planId, remarks } = req.body;
        const plan = await HandoverPlan.findOne({ _id: planId, tenantId: req.tenantId });
        if (!plan) return res.status(404).json({ message: 'Handover plan not found' });

        plan.managerSignOff = true;
        plan.managerSignOffDate = new Date();
        plan.managerRemarks = remarks || '';

        const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
        plan.isFnFBlocked = blockCheck.isBlocked;
        if (!plan.isFnFBlocked) plan.status = 'Cleared';

        await plan.save();
        logger.info(`[Handover] Manager signed off on plan ${planId}`);
        res.status(200).json({ message: 'Manager sign-off recorded', plan });
    } catch (error) { next(error); }
};

exports.getMyHandover = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const plan = await HandoverPlan.findOne({ employeeId: employee._id, tenantId: req.tenantId });
        res.status(200).json({ plan });
    } catch (error) { next(error); }
};

exports.checkFnFEligibility = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const plan = await HandoverPlan.findOne({ employeeId, tenantId: req.tenantId });

        if (!plan) {
            return res.status(200).json({ isEligible: true, reason: 'No active handover plan found. Clear to proceed.' });
        }

        const blockCheck = checkFnFBlock(plan, plan.clearanceScore);
        res.status(200).json({
            isEligible: !blockCheck.isBlocked,
            reason: blockCheck.reason,
            clearanceScore: plan.clearanceScore
        });
    } catch (error) { next(error); }
};
