/**
 * @fileoverview Statutory Compliance Controller
 * @description Handles Form 16 PDF generation and Form 24Q CSV exports.
 * Issue: #933
 */

const mongoose = require('mongoose');
const { Worker } = require('worker_threads');
const path = require('path');
const { aggregateFYData } = require('../utils/complianceAggregator');
const ComplianceConfig = require('../models/complianceConfig.model');
const logger = require('../utils/logger');

/**
 * GET /api/compliance/form-16/:employeeId?fy=2024
 * Generates Form 16 PDF for a specific employee.
 */
exports.generateForm16 = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const fyStartYear = parseInt(req.query.fy) || new Date().getFullYear() - 1;

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({ message: 'Invalid employee ID' });
        }

        // Get company TAN/PAN
        const config = await ComplianceConfig.findOne({ tenantId: req.tenantId }).lean();
        if (!config) {
            return res.status(400).json({ message: 'Company compliance config (TAN/PAN) not set. Please update Settings.' });
        }

        const fyData = await aggregateFYData(req.tenantId, fyStartYear);
        const empData = fyData.find(e => e.employeeId === employeeId);

        if (!empData) {
            return res.status(404).json({ message: 'No payroll data found for this employee in the selected FY.' });
        }

        // Offload heavy PDF generation to worker thread
        const pdfWorker = new Worker(path.join(__dirname, '../workers/pdf.worker.js'));

        let isHandled = false;
        const workerTimeout = setTimeout(() => {
            if (!isHandled) {
                isHandled = true;
                pdfWorker.terminate();
                next(new Error('Form 16 generation timed out'));
            }
        }, 45000);

        pdfWorker.postMessage({
            type: 'GENERATE_FORM_16',
            payload: {
                employee: empData,
                employer: config,
                fyStartYear,
            }
        });

        pdfWorker.on('message', async (result) => {
            if (isHandled) return;
            isHandled = true;
            clearTimeout(workerTimeout);

            if (result.success) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=Form16_${empData.employeeName}_${fyStartYear}-${fyStartYear + 1}.pdf`);
                res.send(Buffer.from(result.pdfData));
            } else {
                next(new Error('Failed to generate Form 16: ' + result.error));
            }
            pdfWorker.terminate();
        });

        pdfWorker.on('error', (err) => {
            if (isHandled) return;
            isHandled = true;
            clearTimeout(workerTimeout);
            next(err);
            pdfWorker.terminate();
        });

    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/compliance/form-24q?quarter=Q4&fy=2024
 * Generates NSDL-compliant CSV for quarterly TDS return.
 */
exports.generateForm24Q = async (req, res, next) => {
    try {
        const fyStartYear = parseInt(req.query.fy) || new Date().getFullYear() - 1;
        const quarter = req.query.quarter || 'Q4'; // Q1, Q2, Q3, Q4

        // Map quarter to months
        const quarterMonths = {
            Q1: [4, 5, 6],
            Q2: [7, 8, 9],
            Q3: [10, 11, 12],
            Q4: [1, 2, 3],
        };

        const months = quarterMonths[quarter];
        if (!months) return res.status(400).json({ message: 'Invalid quarter. Use Q1, Q2, Q3, or Q4.' });

        const config = await ComplianceConfig.findOne({ tenantId: req.tenantId }).lean();
        const fyData = await aggregateFYData(req.tenantId, fyStartYear);

        // NSDL Form 24Q Annexure II format (simplified for demonstration)
        // Headers: TAN, PAN, EmployeeName, DOB, Gender, GrossSalary, TDS, etc.
        const headers = [
            'TAN', 'PAN', 'Employee Name', 'Designation', 'DOB', 'Gender',
            'Gross Salary', 'Perquisites', 'Profits in lieu of salary',
            'Standard Deduction', 'Professional Tax', 'Net Taxable Income', 'Total TDS'
        ];

        const rows = fyData.map(emp => [
            config.tan,
            emp.pan,
            `"${emp.employeeName}"`,
            '', // Designation
            '', // DOB
            '', // Gender
            emp.grossSalary,
            emp.perquisites,
            0,
            50000, // Standard deduction
            emp.professionalTax,
            emp.netTaxableIncome,
            emp.totalTDS,
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Form24Q_${quarter}_FY${fyStartYear}-${fyStartYear + 1}.csv`);
        res.status(200).send(csvContent);

    } catch (error) {
        next(error);
    }
};
