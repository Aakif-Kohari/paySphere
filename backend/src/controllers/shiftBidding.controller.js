/**
 * @fileoverview Shift Bidding Controller
 * @description Manages open shift posting, employee bidding, compliance pre-checks,
 * and automated award assignment utilizing labor fatigue rules & seniority tie-breaking.
 */
const mongoose = require('mongoose');
const { OpenShift, ShiftBid } = require('../models/shiftMarketplace.model');
const Employee = require('../models/employee.model');
const { ShiftRoster } = require('../models/shiftRoster.model');
const {
  checkShiftConflicts,
  calculatePriorityScore,
  evaluateShiftFatigueRules,
  rankBiddersBySeniorityAndScore,
} = require('../utils/shiftConflict.utils');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/shifts/marketplace/open
 * Manager posts an uncovered shift to the marketplace.
 */
exports.postOpenShift = async (req, res, next) => {
  try {
    const {
      shiftTemplateId,
      date,
      startTime,
      endTime,
      requiredRole,
      requiredDepartment,
      premiumMultiplier,
      reason,
    } = req.body;

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
      expiresAt,
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

    const conflictCheck = await checkShiftConflicts(
      req.tenantId,
      employee._id,
      openShift.date,
      openShift.startTime,
      openShift.endTime,
    );

    if (conflictCheck.hasConflict) {
      return res.status(400).json({
        message: 'Cannot bid: Labor rest or schedule conflict detected.',
        conflicts: conflictCheck.reasons,
      });
    }

    const priorityScore = calculatePriorityScore(employee, openShift);

    const bid = await ShiftBid.create({
      tenantId: req.tenantId,
      openShiftId: openShift._id,
      employeeId: employee._id,
      priorityScore,
      bidMessage: req.body.message || '',
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
      expiresAt: { $gt: new Date() },
    })
      .populate('shiftTemplateId', 'name colorCode')
      .sort({ date: 1, startTime: 1 });

    res.status(200).json({ shifts });
  } catch (error) { next(error); }
};

/**
 * GET /api/shifts/marketplace/compliance-check
 * Pre-validates shift assignment against labor rest and fatigue rules.
 */
exports.checkShiftCompliance = async (req, res, next) => {
  try {
    const { employeeId, date, startTime, endTime } = req.query;
    if (!employeeId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'employeeId, date, startTime, and endTime are required' });
    }

    const conflictCheck = await checkShiftConflicts(
      req.tenantId,
      employeeId,
      new Date(date),
      startTime,
      endTime,
    );

    res.status(200).json({
      success: true,
      isCompliant: !conflictCheck.hasConflict,
      violations: conflictCheck.reasons,
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/shifts/marketplace/:id/assign
 * Manager assigns open shift using seniority and priority tie-breaking.
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

    const bids = await ShiftBid.find({
      openShiftId: openShift._id,
      status: 'Pending',
    }).session(session);

    if (!bids.length) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No valid bids available.' });
    }

    const employeeIds = bids.map((b) => b.employeeId);
    const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();
    const empMap = new Map(employees.map((e) => [String(e._id), e]));

    const rankedBids = rankBiddersBySeniorityAndScore(bids, empMap);
    const winningBid = rankedBids[0];

    await ShiftRoster.create(
      [
        {
          tenantId: req.tenantId,
          employeeId: winningBid.employeeId,
          shiftTemplateId: openShift.shiftTemplateId,
          date: openShift.date,
          status: 'Scheduled',
        },
      ],
      { session },
    );

    openShift.status = 'Assigned';
    openShift.assignedTo = winningBid.employeeId;
    await openShift.save({ session });

    winningBid.status = 'Accepted';
    await winningBid.save({ session });

    await ShiftBid.updateMany(
      { openShiftId: openShift._id, _id: { $ne: winningBid._id }, status: 'Pending' },
      { $set: { status: 'Rejected' } },
      { session },
    );

    await session.commitTransaction();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'SHIFT_MARKETPLACE_ASSIGNED',
      resourceType: 'OpenShift',
      resourceIds: [openShift._id],
      details: {
        assignedTo: winningBid.employeeId,
        priorityScore: winningBid.priorityScore,
      },
      req,
    });

    res.status(200).json({
      message: 'Shift assigned successfully using seniority-weighted priority',
      openShift,
      winningBid,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
