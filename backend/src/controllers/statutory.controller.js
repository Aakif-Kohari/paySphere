/**
 * @fileoverview Statutory Compliance Controller
 * @description Manages ECR file generation, validation, and compliance vault history.
 * Issue: #1169
 */
const { StatutoryChallan } = require('../models/statutoryChallan.model');
const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const { generateEPFOEcrText } = require('../utils/ecrGenerator.utils');
const logger = require('../utils/logger');

exports.generateECR = async (req, res, next) => {
    try {
        const { type, month, year } = req.body;

        // Check if already generated
        const existing = await StatutoryChallan.findOne({ tenantId: req.tenantId, type, month, year });
        if (existing) return res.status(409).json({ message: 'ECR for this month already generated.', challan: existing });

        // Fetch finalized payrolls for the month
        const payrolls = await PayrollUpdate.find({
            tenantId: req.tenantId, month, year, status: { $in: ['approved', 'paid'] }
        }).lean();

        if (payrolls.length === 0) {
            return res.status(400).json({ message: 'No finalized payroll data found for this month.' });
        }

        // Join with Employee data for UAN/PF details
        const empIds = payrolls.map(p => p.employeeId);
        const employees = await Employee.find({ _id: { $in: empIds } }).lean();
        const empMap = new Map(employees.map(e => [e._id.toString(), e]));

        const joinedData = payrolls.map(p => ({
            employee: empMap.get(p.employeeId.toString()),
            payroll: p
        })).filter(d => d.employee);

        let result;
        if (type === 'EPFO') {
            result = generateEPFOEcrText(joinedData, month, year);
        } else {
            return res.status(400).json({ message: 'Only EPFO ECR generation is supported in this release.' });
        }

        // In production, upload result.ecrText to S3 and get URL. Mocking here.
        const mockFileUrl = `mock://ecr-files/${tenantId}-${type}-${month}-${year}.txt`;

        const challan = await StatutoryChallan.create({
            tenantId: req.tenantId,
            type,
            month,
            year,
            status: result.errors.length > 0 ? 'Failed Validation' : 'Generated',
            ecrFileUrl: mockFileUrl,
            totalEmployees: result.summary.totalEmployees,
            totalGrossWages: result.summary.totalGrossWages,
            totalEmployerContribution: result.summary.totalEmployerContribution,
            totalEmployeeContribution: result.summary.totalEmployeeContribution,
            totalChallanAmount: result.summary.totalChallanAmount,
            validationErrors: result.errors,
            generatedBy: req.userId
        });

        res.status(201).json({ message: 'ECR generated successfully', challan });
    } catch (error) { next(error); }
};

exports.uploadPaymentReceipt = async (req, res, next) => {
    try {
        const { challanId, receiptUrl } = req.body;
        const challan = await StatutoryChallan.findOne({ _id: challanId, tenantId: req.tenantId });
        if (!challan) return res.status(404).json({ message: 'Challan not found' });

        challan.paymentReceiptUrl = receiptUrl;
        challan.status = 'Paid';
        challan.paidAt = new Date();
        await challan.save();

        res.status(200).json({ message: 'Payment receipt uploaded and challan marked as Paid.', challan });
    } catch (error) { next(error); }
};

exports.getVaultHistory = async (req, res, next) => {
    try {
        const history = await StatutoryChallan.find({ tenantId: req.tenantId })
            .sort({ year: -1, month: -1, type: 1 });
        res.status(200).json({ history });
    } catch (error) { next(error); }
};
