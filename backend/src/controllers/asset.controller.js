/**
 * @fileoverview Asset Management Controller
 * @description Handles CRUD, assignment, check-in, and depreciation workflows.
 * Issue: #955
 */
const mongoose = require('mongoose');
const { Asset, AssetCategory, AssetAssignment } = require('../models/asset.model');
const Employee = require('../models/employee.model');
const { calculateMonthlyDepreciation } = require('../utils/depreciationCalculator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/assets/categories
 * Create a new asset category with depreciation rules.
 */
exports.createCategory = async (req, res, next) => {
    try {
        const { name, depreciationMethod, usefulLifeYears, salvageValuePercentage } = req.body;
        const category = await AssetCategory.create({
            tenantId: req.tenantId,
            name,
            depreciationMethod,
            usefulLifeYears,
            salvageValuePercentage,
        });
        res.status(201).json({ message: 'Category created', category });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Category name already exists' });
        next(error);
    }
};

/**
 * POST /api/assets
 * Procure and register a new asset.
 */
exports.createAsset = async (req, res, next) => {
    try {
        const { categoryId, name, serialNumber, purchaseDate, purchasePrice } = req.body;

        const category = await AssetCategory.findOne({ _id: categoryId, tenantId: req.tenantId });
        if (!category) return res.status(404).json({ message: 'Asset category not found' });

        const asset = await Asset.create({
            tenantId: req.tenantId,
            categoryId,
            name,
            serialNumber,
            purchaseDate: new Date(purchaseDate),
            purchasePrice,
            currentBookValue: purchasePrice, // Starts at purchase price
        });

        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'ASSET_PROCURED',
            resourceType: 'Asset',
            resourceIds: [asset._id],
            details: { name, serialNumber, purchasePrice },
            req,
        });

        res.status(201).json({ message: 'Asset registered', asset });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Serial number already exists' });
        next(error);
    }
};

/**
 * GET /api/assets
 * List all assets with populated category and assignee details.
 */
exports.getAssets = async (req, res, next) => {
    try {
        const assets = await Asset.find({ tenantId: req.tenantId })
            .populate('categoryId', 'name depreciationMethod')
            .populate('assignedTo', 'fullName department role')
            .sort({ createdAt: -1 });
        res.status(200).json({ assets });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/assets/:id/assign
 * Assign an asset to an employee (Checkout).
 */
exports.assignAsset = async (req, res, next) => {
    try {
        const { employeeId, conditionNotes } = req.body;
        const asset = await Asset.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!asset) return res.status(404).json({ message: 'Asset not found' });
        if (asset.status !== 'Available') return res.status(400).json({ message: 'Asset is not available for assignment' });

        const employee = await Employee.findOne({ _id: employeeId, tenantId: req.tenantId, isDeleted: { $ne: true } });
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Update Asset
        asset.status = 'Assigned';
        asset.assignedTo = employeeId;
        asset.conditionNotes = conditionNotes || 'Good';
        await asset.save();

        // Create Assignment History
        await AssetAssignment.create({
            tenantId: req.tenantId,
            assetId: asset._id,
            employeeId,
            checkoutCondition: asset.conditionNotes,
        });

        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'ASSET_ASSIGNED',
            resourceType: 'Asset',
            resourceIds: [asset._id],
            details: { employeeName: employee.fullName, assetName: asset.name },
            req,
        });

        res.status(200).json({ message: 'Asset assigned successfully', asset });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/assets/:id/return
 * Return an asset from an employee (Check-in). Handles damage recovery.
 */
exports.returnAsset = async (req, res, next) => {
    try {
        const { checkinCondition, damageReported, recoveryAmount } = req.body;
        const asset = await Asset.findOne({ _id: req.params.id, tenantId: req.tenantId });

        if (!asset || asset.status !== 'Assigned') {
            return res.status(400).json({ message: 'Asset is not currently assigned' });
        }

        // Find active assignment
        const assignment = await AssetAssignment.findOne({ assetId: asset._id, isActive: true });
        if (!assignment) return res.status(404).json({ message: 'Active assignment record not found' });

        // Update Assignment
        assignment.checkinDate = new Date();
        assignment.checkinCondition = checkinCondition;
        assignment.damageReported = !!damageReported;
        assignment.recoveryAmount = Number(recoveryAmount) || 0;
        assignment.isActive = false;
        await assignment.save();

        // Update Asset
        asset.status = damageReported ? 'Maintenance' : 'Available';
        asset.assignedTo = null;
        asset.conditionNotes = checkinCondition;
        await asset.save();

        // If damaged and recovery amount > 0, this would typically link to a payroll deduction
        // For now, we log it. In a full implementation, we'd create an ExpenseClaim/Deduction record.
        if (damageReported && recoveryAmount > 0) {
            logger.info(`Asset damage recovery required: ₹${recoveryAmount} from employee ${assignment.employeeId}`);
            // TODO: Integrate with Payroll Deductions module
        }

        res.status(200).json({ message: 'Asset returned successfully', asset, assignment });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/assets/depreciate (Internal / Cron Job Endpoint)
 * Runs monthly depreciation for all active assets.
 */
exports.runMonthlyDepreciation = async (req, res, next) => {
    try {
        const assets = await Asset.find({
            tenantId: req.tenantId,
            status: { $nin: ['Retired', 'Lost'] }
        }).populate('categoryId');

        let totalDepreciation = 0;
        let updatedCount = 0;

        for (const asset of assets) {
            if (!asset.categoryId) continue;

            const expense = calculateMonthlyDepreciation(asset, asset.categoryId);
            if (expense > 0) {
                asset.currentBookValue -= expense;
                await asset.save();
                totalDepreciation += expense;
                updatedCount++;
            }
        }

        logger.info(`Monthly depreciation completed. Updated ${updatedCount} assets. Total expense: ₹${totalDepreciation}`);
        res.status(200).json({ message: 'Depreciation processed', updatedCount, totalDepreciation });
    } catch (error) {
        next(error);
    }
};
