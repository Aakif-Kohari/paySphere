/**
 * @fileoverview Expense Policy & Claim Schemas
 * @description Defines company-wide expense rules, category limits, and tracks
 * individual expense claims with OCR-extracted receipt data.
 * Issue: #1082
 */
const mongoose = require('mongoose');

const categoryLimitSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        'Travel',
        'Meals',
        'Lodging',
        'Office Supplies',
        'Software',
        'Client Entertainment',
        'Other',
      ],
    },
    maxLimitPerClaim: { type: Number, required: true, min: 0 },
    maxLimitPerMonth: { type: Number, default: 0, min: 0 }, // 0 means unlimited
    requiresReceipt: { type: Boolean, default: true },
    receiptThreshold: { type: Number, default: 50 }, // Receipt required if amount > threshold
    weekendAllowed: { type: Boolean, default: true },
  },
  { _id: false },
);

const expensePolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
    },
    currency: { type: String, default: 'INR' },
    autoApprovalThreshold: { type: Number, default: 1000 }, // Auto-approve if total < threshold and no violations
    categories: [categoryLimitSchema],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const ExpensePolicy = mongoose.model('ExpensePolicy', expensePolicySchema);

const expenseClaimSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    expenseDate: { type: Date, required: true },
    merchant: { type: String, default: '' },
    description: { type: String, required: true },

    // OCR Data
    receiptUrl: { type: String, default: '' },
    ocrConfidence: { type: Number, default: 0 },
    ocrRawText: { type: String, default: '' },

    // Policy Evaluation
    policyViolations: [{ type: String }],
    isCompliant: { type: Boolean, default: true },

    status: {
      type: String,
      enum: [
        'Draft',
        'Submitted',
        'Auto-Approved',
        'Pending Manager',
        'Approved',
        'Rejected',
        'Paid',
      ],
      default: 'Draft',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: { type: String, default: '' },
    imageHash: { type: String, default: '' },
    isPossibleFraud: { type: Boolean, default: false },
    fraudDetails: { type: String, default: '' },
    ocrMetadata: {
      amountMatches: { type: Boolean, default: true },
      dateMatches: { type: Boolean, default: true },
      currencyMatches: { type: Boolean, default: true },
      extractedAmount: { type: Number },
      extractedDate: { type: Date },
      extractedCurrency: { type: String }
    },
  },
  { timestamps: true },
);

expenseClaimSchema.index({ tenantId: 1, employeeId: 1, expenseDate: -1 });
const ExpenseClaim =
  mongoose.models.ExpenseClaim ||
  mongoose.model('ExpenseClaim', expenseClaimSchema);

module.exports = { ExpensePolicy, ExpenseClaim };
