/**
 * @fileoverview Timesheet Controller
 * @description Manages start/stop timers, manual entries, and milestone approvals.
 * Issue: #1000
 */
const mongoose = require('mongoose');
const { TimesheetEntry, ProjectMilestone } = require('../models/timesheet.model');
const Vendor = require('../models/vendor.model').Vendor;
const {
    calculateDurationMinutes,
    calculateBillableAmount,
    detectIdleOrFraud
} = require('../utils/timesheetAggregator');
const logger = require('../utils/logger');

/**
 * POST /api/timesheets/start
 * Starts a new timer for a gig-worker.
 */
exports.startTimer = async (req, res, next) => {
    try {
        const { projectId, description } = req.body;

        // In a real app, contractorId maps to the logged-in user's vendor profile
        // For this implementation, we assume req.vendorId is set by a vendor-auth middleware
        const contractorId = req.vendorId || req.body.contractorId;
        if (!contractorId) return res.status(400).json({ message: 'Contractor identification required' });

        const vendor = await Vendor.findOne({ _id: contractorId, tenantId: req.tenantId });
        if (!vendor) return res.status(404).json({ message: 'Contractor not found' });

        // Check for existing running timers to prevent concurrent tracking
        const runningTimer = await TimesheetEntry.findOne({
            tenantId: req.tenantId,
            contractorId,
            status: 'In Progress',
            endTime: null
        });

        if (runningTimer) {
            return res.status(409).json({
                message: 'You already have a running timer. Please stop it before starting a new one.',
                activeTimer: runningTimer
            });
        }

        const hourlyRate = vendor.hourlyRate || 0; // Assuming hourlyRate is added to Vendor schema or fetched from contract

        const entry = await TimesheetEntry.create({
            tenantId: req.tenantId,
            contractorId,
            projectId,
            startTime: new Date(),
            hourlyRate,
            description,
            entryType: 'Timer',
            deviceIp: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json({ message: 'Timer started', entry });
    } catch (error) { next(error); }
};

/**
 * POST /api/timesheets/stop
 * Stops the active timer and calculates billable amount.
 */
exports.stopTimer = async (req, res, next) => {
    try {
        const contractorId = req.vendorId || req.body.contractorId;

        const entry = await TimesheetEntry.findOne({
            tenantId: req.tenantId,
            contractorId,
            status: 'In Progress',
            endTime: null
        });

        if (!entry) return res.status(404).json({ message: 'No active timer found' });

        entry.endTime = new Date();
        entry.durationMinutes = calculateDurationMinutes(entry.startTime, entry.endTime);

        // Run fraud/idle detection
        const fraudCheck = detectIdleOrFraud(entry.durationMinutes);
        entry.isFlagged = fraudCheck.isFlagged;
        entry.flagReason = fraudCheck.reason;

        // Calculate billing
        entry.billableAmount = calculateBillableAmount(entry.durationMinutes, entry.hourlyRate);
        entry.status = 'Pending Approval';

        await entry.save();

        res.status(200).json({ message: 'Timer stopped and logged', entry });
    } catch (error) { next(error); }
};

/**
 * PATCH /api/timesheets/:id/approve
 * Manager approves a timesheet entry (or milestone) for billing.
 */
exports.approveEntry = async (req, res, next) => {
    try {
        const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'
        const entry = await TimesheetEntry.findById(req.params.id);

        if (!entry) return res.status(404).json({ message: 'Timesheet entry not found' });
        if (entry.status !== 'Pending Approval') {
            return res.status(400).json({ message: 'Entry is not pending approval' });
        }

        if (action === 'approve') {
            entry.status = 'Approved';
            entry.approvedBy = req.userId;
            entry.approvedAt = new Date();
            entry.isFlagged = false; // Clear flags upon manager override
        } else {
            entry.status = 'Rejected';
            entry.rejectionReason = rejectionReason || 'Rejected by manager';
        }

        await entry.save();
        res.status(200).json({ message: `Entry ${action}d`, entry });
    } catch (error) { next(error); }
};
