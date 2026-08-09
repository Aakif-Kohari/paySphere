/**
 * @fileoverview Expense Category Schema
 * @description Defines the types of expenses employees can claim (e.g., Travel, Meals).
 * Includes an `isTaxable` flag to determine how the reimbursement is treated 
 * during payroll calculation (tax-free vs taxable bonus).
 * 
 * Issue: #719
 */

const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            default: '',
            maxlength: 500,
        },
        isTaxable: {
            type: Boolean,
            default: false, // Most reimbursements are tax-free
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }
    },
    { timestamps: true }
);

// Unique category names per tenant
expenseCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
