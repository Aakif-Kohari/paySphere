/**
 * @fileoverview Shift Bidding Controller
 * @description Manages the lifecycle of open shifts, bidding, and automated assignment.
 * Issue: #1081
 */
const mongoose = require('mongoose');
const { OpenShift, ShiftBid } = require('../models/shiftMarketplace.model');
const Employee = require('../models/employee.model');
const { ShiftRoster } = require('../models/shiftRoster.model');
const { checkShiftConflicts, calculatePriorityScore } = require('../utils/shiftConflict.utils');
const logger = require('../utils/logger');

/**
 * POST /api/shifts/marketplace/open
 * Manager posts an uncovered shift to the marketplace.
 */
exports.postOpenShift = async (req, res, next) => {
    try {
        const { shiftTemplateId, date, startTime, endTime, requiredRole, requiredDepartment, premiumMultiplier, reason } = req.body;

        // Auto-expire 2 hours before the shift starts
        const shiftStart = new Date(date);
        const [h, m] = startTime.split(':').map(Number);
        shiftStart.setHours(h, m, 0, 0);
        const expiresAt = new Date(shiftStart.getTime() - 2 * 60 * 60 * 1000);

        const openShift = await OpenShift.create({
            tenantId: req.tenantId,
            shiftTemplateId,
            date: new Date(date),
            startTime,
            endTime,
            requiredRole,
            requiredDepartment,
            premiumMultiplier: premiumMultiplier || 1.0,
            reason,
            postedBy: req.userId,
            expiresAt
        });

        res.status(201).json({ message: 'Shift posted to marketplace', openShift });
    } catch (error) { next(error); }
};

/**
 * POST /api/shifts/marketplace/:id/bid
 * Employee places a bid on an open shift.
 */
exports.placeBid = async (req, res, next) => {
    try {
        const openShift = await OpenShift.findById(req.params.id);
        if (!openShift || openShift.status !== 'Open') {
            return res.status(400).json({ message: 'Shift is no longer open for bidding.' });
        }

        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found.' });

        // Check for schedule conflicts
        const conflictCheck = await checkShiftConflicts(
            req.tenantId,
            employee._id,
            openShift.date,
            openShift.startTime,
            openShift.endTime
        );

        if (conflictCheck.hasConflict) {
            return res.status(400).json({
                message: 'Cannot bid: Schedule conflict detected.',
                conflicts: conflictCheck.reasons
            });
        }

        const priorityScore = calculatePriorityScore(employee, openShift);

        const bid = await ShiftBid.create({
            tenantId: req.tenantId,
            openShiftId: openShift._id,
            employeeId: employee._id,
            priorityScore,
            bidMessage: req.body.message || ''
        });

        res.status(201).json({ message: 'Bid placed successfully', bid });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'You have already bid on this shift.' });
        next(error);
    }
};

/**
 * GET /api/shifts/marketplace
 * Fetches open shifts available for bidding.
 */
exports.getMarketplace = async (req, res, next) => {
    try {
        const shifts = await OpenShift.find({
            tenantId: req.tenantId,
            status: 'Open',
            expiresAt: { $gt: new Date() }
        }).populate('shiftTemplateId', 'name colorCode').sort({ date: 1, startTime: 1 });

        res.status(200).json({ shifts });
    } catch (error) { next(error); }
};

/**
 * POST /api/shifts/marketplace/:id/assign
 * Manager manually assigns the shift to the highest priority bidder (or auto-assign daemon logic).
 */
exports.assignShift = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const openShift = await OpenShift.findById(req.params.id).session(session);
        if (!openShift || openShift.status !== 'Open') {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Shift is not open.' });
        }

        // Find highest priority pending bid
        const winningBid = await ShiftBid.findOne({
            openShiftId: openShift._id,
            status: 'Pending'
        }).sort({ priorityScore: -1 }).session(session);

        if (!winningBid) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'No valid bids available.' });
        }

        // Create roster entry
        await ShiftRoster.create([{
            tenantId: req.tenantId,
            employeeId: winningBid.employeeId,
            shiftTemplateId: openShift.shiftTemplateId,
            date: openShift.date,
            status: 'Scheduled'
        }], { session });

        // Update shift and bid statuses
        openShift.status = 'Assigned';
        openShift.assignedTo = winningBid.employeeId;
        await openShift.save({ session });

        winningBid.status = 'Accepted';
        await winningBid.save({ session });

        // Reject/Waitlist other bids
        await ShiftBid.updateMany(
            { openShiftId: openShift._id, _id: { $ne: winningBid._id }, status: 'Pending' },
            { $set: { status: 'Rejected' } },
            { session }
        );

        await session.commitTransaction();
        res.status(200).json({ message: 'Shift assigned successfully', openShift });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};
