/**
 * @fileoverview Onboarding Controller
 * @description Manages onboarding plans, triggers orchestration, and handles task/document updates.
 * Issue: #998
 */
const mongoose = require('mongoose');
const { OnboardingPlan, OnboardingTask, OnboardingDocument } = require('../models/onboarding.model');
const Employee = require('../models/employee.model');
const { orchestrateOnboarding, checkTaskDependencies } = require('../utils/onboardingOrchestrator');
const logger = require('../utils/logger');

exports.createPlan = async (req, res, next) => {
    try {
        const { name, description, tasks } = req.body;
        const plan = await OnboardingPlan.create({
            tenantId: req.tenantId, name, description, tasks, createdBy: req.userId
        });
        res.status(201).json({ message: 'Onboarding plan created', plan });
    } catch (error) { next(error); }
};

exports.getPlans = async (req, res, next) => {
    try {
        const plans = await OnboardingPlan.find({ tenantId: req.tenantId, isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({ plans });
    } catch (error) { next(error); }
};

exports.triggerOnboarding = async (req, res, next) => {
    try {
        const { employeeId, planId } = req.body;
        const employee = await Employee.findOne({ _id: employeeId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const joiningDate = employee.joiningDate || new Date();
        const tasks = await orchestrateOnboarding(req.tenantId, employeeId, planId, joiningDate);

        res.status(201).json({ message: 'Onboarding triggered successfully', taskCount: tasks.length });
    } catch (error) { next(error); }
};

exports.getMyTasks = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const tasks = await OnboardingTask.find({ employeeId: employee._id, tenantId: req.tenantId })
            .sort({ dueDate: 1 });

        const completedCount = tasks.filter(t => t.status === 'Completed').length;
        const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

        res.status(200).json({ tasks, progress });
    } catch (error) { next(error); }
};

exports.updateTaskStatus = async (req, res, next) => {
    try {
        const { status, notes } = req.body;
        const task = await OnboardingTask.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        if (status === 'Completed') {
            const depCheck = await checkTaskDependencies(task._id);
            if (!depCheck.canComplete) {
                return res.status(400).json({
                    message: 'Cannot complete task. Dependencies not met.',
                    blockedBy: depCheck.blockedBy
                });
            }
            task.completedAt = new Date();
            task.completedBy = req.userId;
        }

        task.status = status;
        task.notes = notes || task.notes;
        await task.save();

        res.status(200).json({ message: 'Task updated', task });
    } catch (error) { next(error); }
};

exports.uploadDocument = async (req, res, next) => {
    try {
        const { documentType, fileUrl, fileName } = req.body;
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });

        const doc = await OnboardingDocument.create({
            tenantId: req.tenantId,
            employeeId: employee._id,
            documentType,
            fileUrl,
            fileName
        });

        res.status(201).json({ message: 'Document uploaded', doc });
    } catch (error) { next(error); }
};
