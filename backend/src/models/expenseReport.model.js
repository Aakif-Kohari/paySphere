const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const expenseReportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    claimIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpenseClaim',
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'reimbursed', 'rejected'],
      default: 'submitted',
    },
    reimbursedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

expenseReportSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
expenseReportSchema.index({ tenantId: 1, employeeId: 1, createdAt: -1 });
expenseReportSchema.index({ tenantId: 1, status: 1 });

expenseReportSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('ExpenseReport', expenseReportSchema);
