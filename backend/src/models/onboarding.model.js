/**
 * @fileoverview Onboarding Schemas
 * @description Manages onboarding plans, task templates, and employee-specific task instances.
 * Issue: #998
 */
const mongoose = require('mongoose');

const onboardingTaskTemplateSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    department: { type: String, enum: ['HR', 'IT', 'Finance', 'Manager', 'Employee'], required: true },
    dueOffsetDays: { type: Number, required: true }, // Days relative to joining date (e.g., -2, 0, 7, 30)
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTaskTemplate' }],
    isMandatory: { type: Boolean, default: true },
}, { _id: true });

const onboardingPlanSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "Standard Engineering Onboarding"
    description: { type: String, default: '' },
    tasks: [onboardingTaskTemplateSchema],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const OnboardingPlan = mongoose.model('OnboardingPlan', onboardingPlanSchema);

const onboardingTaskInstanceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingPlan', required: true },
    templateTaskId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    department: { type: String, required: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Specific user or null for role-based
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Blocked'], default: 'Pending' },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' },
}, { timestamps: true });

onboardingTaskInstanceSchema.index({ employeeId: 1, status: 1 });
const OnboardingTask = mongoose.model('OnboardingTask', onboardingTaskInstanceSchema);

const onboardingDocumentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    documentType: { type: String, required: true }, // e.g., 'PAN', 'Aadhar', 'Bank Statement'
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    status: { type: String, enum: ['Pending Verification', 'Verified', 'Rejected'], default: 'Pending Verification' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '' },
}, { timestamps: true });

const OnboardingDocument = mongoose.model('OnboardingDocument', onboardingDocumentSchema);

module.exports = { OnboardingPlan, OnboardingTask, OnboardingDocument };
