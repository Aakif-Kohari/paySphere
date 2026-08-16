/**
 * @fileoverview Compliance Gatekeeper Utility
 * @description Intercepts critical HR workflows (like Appraisal Self-Reviews) to ensure
 * the employee has completed all mandatory training and holds valid certifications.
 * Issue: #1085
 */
const { EmployeeTrainingRecord, TrainingCourse } = require('../models/training.model');

/**
 * Checks if an employee is compliant with all mandatory training requirements.
 * Used to gate performance appraisal submissions or promotion eligibility.
 * 
 * @param {string} employeeId 
 * @param {string} tenantId 
 * @returns {Promise<{isCompliant: boolean, missingCourses: string[], expiredCourses: string[]}>}
 */
async function checkMandatoryCompliance(employeeId, tenantId) {
    // Fetch all mandatory courses for the tenant
    const mandatoryCourses = await TrainingCourse.find({
        tenantId,
        isMandatory: true,
        isActive: true
    });

    if (mandatoryCourses.length === 0) {
        return { isCompliant: true, missingCourses: [], expiredCourses: [] };
    }

    // Fetch employee's training records
    const records = await EmployeeTrainingRecord.find({
        tenantId,
        employeeId,
        courseId: { $in: mandatoryCourses.map(c => c._id) }
    }).populate('courseId', 'title');

    const recordMap = new Map(records.map(r => [r.courseId._id.toString(), r]));

    const missingCourses = [];
    const expiredCourses = [];

    for (const course of mandatoryCourses) {
        const record = recordMap.get(course._id.toString());

        if (!record) {
            // Course was never assigned or completed
            missingCourses.push(course.title);
            continue;
        }

        if (record.status === 'Expired') {
            expiredCourses.push(course.title);
        } else if (record.status !== 'Completed' && record.status !== 'Waived') {
            // Assigned, In Progress, etc.
            missingCourses.push(course.title);
        }
    }

    return {
        isCompliant: missingCourses.length === 0 && expiredCourses.length === 0,
        missingCourses,
        expiredCourses
    };
}

module.exports = { checkMandatoryCompliance };
