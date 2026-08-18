/**
 * @fileoverview TOIL Controller
 * @description Manages policy configuration, balance fetching, and time-off requests.
 * Issue: #1165
 */
const { ToilPolicy, ToilLedger, ToilRequest } = require('../models/toil.model');
const Employee = require('../models/employee.model');
const { getCurrentBalance } = require('../utils/toilCalculator.utils');

exports.getPolicy = async (req, res, next) => {
    try {
        let policy = await ToilPolicy.findOne({ tenantId: req.tenantId });
        if (!policy) policy = await ToilPolicy.create({ tenantId: req.tenantId });
        res.status(200).json({ policy });
    } catch (error) { next(error); }
};

exports.updatePolicy = async (req, res, next) => {
    try {
        const policy = await ToilPolicy.findOneAndUpdate(
            { tenantId: req.tenantId },
            { ...req.body, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'TOIL policy updated', policy });
    } catch (error) { next(error); }
};

exports.getMyToilData = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const balance = await getCurrentBalance(req.tenantId, employee._id);

        const ledger = await ToilLedger.find({ tenantId: req.tenantId, employeeId: employee._id })
            .sort({ createdAt: -1 }).limit(50);

        // Fetch upcoming expirations (next 30 days)
        const now = new Date();
        const in30Days = new Date(now);
        in30Days.setDate(in30Days.getDate() + 30);

        const expiringSoon = await ToilLedger.find({
            tenantId: req.tenantId,
            employeeId: employee._id,
            transactionType: 'Accrual',
            expiresAt: { $gte: now, $lte: in30Days }
        }).sort({ expiresAt: 1 });

        res.status(200).json({ balance, ledger, expiringSoon });
    } catch (error) { next(error); }
};

exports.requestToil = async (req, res, next) => {
    try {
        const { requestType, daysRequested, startDate, endDate, remarks } = req.body;
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });

        const currentBalance = await getCurrentBalance(req.tenantId, employee._id);
        if (currentBalance < daysRequested) {
            return res.status(400).json({ message: `Insufficient TOIL balance. Available: ${currentBalance} days.` });
        }

        const request = await ToilRequest.create({
            tenantId: req.tenantId,
            employeeId: employee._id,
            requestType,
            daysRequested,
            startDate,
            endDate,
            remarks
        });

        res.status(201).json({ message: 'TOIL request submitted', request });
    } catch (error) { next(error); }
};

exports.approveRequest = async (req, res, next) => {
    try {
        const { status, remarks } = req.body;
        const request = await ToilRequest.findById(req.params.id);
        if (!request || request.status !== 'Pending') {
            return res.status(400).json({ message: 'Request not found or already processed.' });
        }

        request.status = status;
        request.remarks = remarks || request.remarks;
        request.approvedBy = req.userId;
        await request.save();

        if (status === 'Approved') {
            const currentBalance = await getCurrentBalance(req.tenantId, request.employeeId);

            // Deduct from ledger
            await ToilLedger.create({
                tenantId: req.tenantId,
                employeeId: request.employeeId,
                transactionType: 'Usage',
                days: -request.daysRequested,
                balanceAfter: currentBalance - request.daysRequested,
                referenceId: request._id,
                description: `TOIL ${request.requestType} approved for ${request.startDate ? new Date(request.startDate).toLocaleDateString() : 'Encashment'}`
            });
        }

        res.status(200).json({ message: `Request ${status}`, request });
    } catch (error) { next(error); }
};
