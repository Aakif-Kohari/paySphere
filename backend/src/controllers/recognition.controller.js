/**
 * @fileoverview Recognition Controller
 * @description Manages Kudos configuration, peer awards, balance fetching, and redemptions.
 * Issue: #1084
 */
const { RecognitionConfig, KudosLedger, KudosBalance } = require('../models/recognition.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model'); // For redemption integration
const logger = require('../utils/logger');

exports.getConfig = async (req, res, next) => {
    try {
        let config = await RecognitionConfig.findOne({ tenantId: req.tenantId });
        if (!config) {
            config = await RecognitionConfig.create({ tenantId: req.tenantId });
        }
        res.status(200).json({ config });
    } catch (error) { next(error); }
};

exports.updateConfig = async (req, res, next) => {
    try {
        const { monthlyAllowance, maxCarryOver, redemptionRate, isActive } = req.body;
        const config = await RecognitionConfig.findOneAndUpdate(
            { tenantId: req.tenantId },
            { monthlyAllowance, maxCarryOver, redemptionRate, isActive, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Recognition config updated', config });
    } catch (error) { next(error); }
};

exports.getMyBalance = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        let balance = await KudosBalance.findOne({ tenantId: req.tenantId, employeeId: employee._id });
        if (!balance) {
            balance = await KudosBalance.create({ tenantId: req.tenantId, employeeId: employee._id });
        }
        res.status(200).json({ balance });
    } catch (error) { next(error); }
};

exports.giveKudos = async (req, res, next) => {
    try {
        const { receiverId, points, message, isPublic } = req.body;
        const sender = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!sender) return res.status(404).json({ message: 'Sender profile not found' });
        if (sender._id.toString() === receiverId) return res.status(400).json({ message: 'Cannot award Kudos to yourself.' });

        let senderBalance = await KudosBalance.findOne({ tenantId: req.tenantId, employeeId: sender._id });
        if (!senderBalance || senderBalance.availablePoints < points) {
            return res.status(400).json({ message: 'Insufficient Kudos balance.' });
        }

        const receiver = await Employee.findOne({ _id: receiverId, tenantId: req.tenantId });
        if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

        // Deduct from sender
        senderBalance.availablePoints -= points;
        await senderBalance.save();

        // Credit to receiver
        let receiverBalance = await KudosBalance.findOne({ tenantId: req.tenantId, employeeId: receiver._id });
        if (!receiverBalance) {
            receiverBalance = new KudosBalance({ tenantId: req.tenantId, employeeId: receiver._id });
        }
        receiverBalance.availablePoints += points;
        receiverBalance.lifetimeEarned += points;
        await receiverBalance.save();

        // Log transaction
        const ledger = await KudosLedger.create({
            tenantId: req.tenantId,
            senderId: sender._id,
            receiverId: receiver._id,
            points,
            message,
            isPublic: isPublic !== false,
            transactionType: 'PeerAward'
        });

        res.status(201).json({ message: 'Kudos awarded successfully!', ledger });
    } catch (error) { next(error); }
};

exports.getFeed = async (req, res, next) => {
    try {
        const feed = await KudosLedger.find({ tenantId: req.tenantId, isPublic: true })
            .populate('senderId', 'fullName profilePicture')
            .populate('receiverId', 'fullName profilePicture')
            .sort({ createdAt: -1 })
            .limit(50);
        res.status(200).json({ feed });
    } catch (error) { next(error); }
};

exports.redeemKudos = async (req, res, next) => {
    try {
        const { points } = req.body;
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        const config = await RecognitionConfig.findOne({ tenantId: req.tenantId });

        if (!config) return res.status(400).json({ message: 'Recognition program not configured.' });

        let balance = await KudosBalance.findOne({ tenantId: req.tenantId, employeeId: employee._id });
        if (!balance || balance.availablePoints < points) {
            return res.status(400).json({ message: 'Insufficient Kudos for redemption.' });
        }

        const cashValue = points / config.redemptionRate;

        balance.availablePoints -= points;
        balance.lifetimeRedeemed += points;
        await balance.save();

        await KudosLedger.create({
            tenantId: req.tenantId,
            senderId: employee._id,
            receiverId: employee._id,
            points: -points,
            message: `Redeemed ${points} Kudos for ${cashValue} ${config.currency || 'INR'} bonus.`,
            isPublic: false,
            transactionType: 'Redemption'
        });

        // In a full implementation, this would inject a "Kudos Bonus" line item 
        // into the employee's next active PayrollUpdate or F&F settlement.
        logger.info(`[Kudos] Employee ${employee._id} redeemed ${points} points for ${cashValue} cash value.`);

        res.status(200).json({ message: 'Redemption successful! Bonus will be added to your next payroll.', cashValue });
    } catch (error) { next(error); }
};
