/**
 * @fileoverview Forecast Controller
 * @description Manages budget scenarios, triggers the forecasting engine, and returns projections.
 * Issue: #985
 */
const mongoose = require('mongoose');
const BudgetForecast = require('../models/budgetForecast.model');
const Employee = require('../models/employee.model');
const { projectMonthlyCashflow } = require('../utils/forecastEngine');
const logger = require('../utils/logger');

/**
 * POST /api/forecasts/generate
 * Generates a 12-month projection based on provided scenario assumptions.
 */
exports.generateForecast = async (req, res, next) => {
    try {
        const {
            name, description, companyWideIncrementPercent, incrementEffectiveMonth,
            includeEmployerPF, includeEmployerESI, hiringPlan, startMonth, startYear
        } = req.body;

        // Fetch all active employees for the tenant
        const employees = await Employee.find({
            tenantId: req.tenantId,
            isActive: true,
            isDeleted: { $ne: true }
        }).lean();

        const scenario = {
            companyWideIncrementPercent: Number(companyWideIncrementPercent) || 0,
            incrementEffectiveMonth: Number(incrementEffectiveMonth) || 4,
            includeEmployerPF: includeEmployerPF !== false,
            includeEmployerESI: includeEmployerESI !== false,
            hiringPlan: hiringPlan || []
        };

        const sMonth = Number(startMonth) || new Date().getMonth() + 1;
        const sYear = Number(startYear) || new Date().getFullYear();

        const projections = projectMonthlyCashflow(employees, scenario, sMonth, sYear);

        const totalAnnualProjectedCost = projections.reduce((sum, p) =>
            sum + p.totalPayrollCost + p.employerStatutoryCost, 0
        );

        // Save the scenario to DB
        const forecast = await BudgetForecast.create({
            tenantId: req.tenantId,
            name,
            description,
            ...scenario,
            projectedMonthlyCashflow: projections,
            totalAnnualProjectedCost,
            createdBy: req.userId
        });

        res.status(201).json({ message: 'Forecast generated and saved', forecast });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/forecasts
 * Fetch all saved scenarios for the tenant.
 */
exports.getForecasts = async (req, res, next) => {
    try {
        const forecasts = await BudgetForecast.find({ tenantId: req.tenantId })
            .select('name description totalAnnualProjectedCost isBaseline createdAt')
            .sort({ createdAt: -1 });
        res.status(200).json({ forecasts });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/forecasts/:id
 * Fetch detailed monthly projection for a specific scenario.
 */
exports.getForecastById = async (req, res, next) => {
    try {
        const forecast = await BudgetForecast.findOne({ _id: req.params.id, tenantId: req.tenantId });
        if (!forecast) return res.status(404).json({ message: 'Forecast not found' });
        res.status(200).json({ forecast });
    } catch (error) {
        next(error);
    }
};
