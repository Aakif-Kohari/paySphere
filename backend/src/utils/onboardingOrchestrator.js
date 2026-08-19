/**
 * @fileoverview Onboarding Orchestration Engine
 * @description Instantiates tasks from templates, calculates due dates, and resolves dependencies.
 * Issue: #998
 */
const { OnboardingPlan, OnboardingTask } = require('../models/onboarding.model');
const logger = require('./logger');

/**
 * Calculates the due date based on the employee's joining date and the task's offset.
 * @param {Date} joiningDate 
 * @param {number} offsetDays 
 * @returns {Date}
 */
function calculateDueDate(joiningDate, offsetDays) {
    const dueDate = new Date(joiningDate);
    dueDate.setDate(dueDate.getDate() + offsetDays);
    // Skip weekends for corporate tasks (optional heuristic)
    const dayOfWeek = dueDate.getDay();
    if (dayOfWeek === 0) dueDate.setDate(dueDate.getDate() + 1); // Sunday -> Monday
    if (dayOfWeek === 6) dueDate.setDate(dueDate.getDate() + 2); // Saturday -> Monday
    return dueDate;
}

/**
 * Orchestrates the creation of onboarding tasks for a new employee.
 * Triggered when an employee's status changes to 'Active' or 'Onboarding'.
 * 
 * @param {string} tenantId 
 * @param {string} employeeId 
 * @param {string} planId 
 * @param {Date} joiningDate 
 */
async function orchestrateOnboarding(tenantId, employeeId, planId, joiningDate) {
    const plan = await OnboardingPlan.findById(planId);
    if (!plan) throw new Error(`Onboarding plan ${planId} not found`);

    const taskInstances = [];
    const templateIdToInstanceIdMap = new Map();

    // First pass: Create all task instances
    for (const templateTask of plan.tasks) {
        const dueDate = calculateDueDate(joiningDate, templateTask.dueOffsetDays);

        const instance = new OnboardingTask({
            tenantId,
            employeeId,
            planId,
            templateTaskId: templateTask._id,
            title: templateTask.title,
            description: templateTask.description,
            department: templateTask.department,
            dueDate,
            status: 'Pending'
        });

        taskInstances.push(instance);
    }

    // Save all instances to generate ObjectIds
    const savedInstances = await OnboardingTask.insertMany(taskInstances);

    // Map template IDs to new instance IDs for dependency tracking (if needed in future updates)
    savedInstances.forEach((inst, index) => {
        templateIdToInstanceIdMap.set(plan.tasks[index]._id.toString(), inst._id);
    });

    logger.info(`Orchestrated ${savedInstances.length} onboarding tasks for employee ${employeeId}`);
    return savedInstances;
}

/**
 * Checks if a task can be marked as complete based on its dependencies.
 * @param {string} taskId 
 * @returns {Promise<{canComplete: boolean, blockedBy: string[]}>}
 */
async function checkTaskDependencies(taskId) {
    const task = await OnboardingTask.findById(taskId).populate({
        path: 'planId',
        select: 'tasks'
    });

    if (!task) return { canComplete: false, blockedBy: ['Task not found'] };

    const templateTask = task.planId.tasks.find(t => t._id.toString() === task.templateTaskId.toString());
    if (!templateTask || !templateTask.dependencies || templateTask.dependencies.length === 0) {
        return { canComplete: true, blockedBy: [] };
    }

    // Find instance IDs for the dependencies
    const dependencyTemplateIds = templateTask.dependencies.map(d => d.toString());

    const dependentTasks = await OnboardingTask.find({
        employeeId: task.employeeId,
        planId: task.planId._id,
        templateTaskId: { $in: dependencyTemplateIds }
    });

    const blockedBy = dependentTasks
        .filter(t => t.status !== 'Completed')
        .map(t => t.title);

    return {
        canComplete: blockedBy.length === 0,
        blockedBy
    };
}

module.exports = { orchestrateOnboarding, checkTaskDependencies, calculateDueDate };
