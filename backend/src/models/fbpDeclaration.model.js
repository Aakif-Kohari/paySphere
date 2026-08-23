const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const {
  COMPONENT_TYPE,
  CALCULATION,
  MAX_COMPONENT_CODE_LENGTH,
  MAX_COMPONENT_LABEL_LENGTH,
} = require('../config/salaryComponents');

const proposedComponentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: [
        MAX_COMPONENT_CODE_LENGTH,
        `Component code cannot exceed ${MAX_COMPONENT_CODE_LENGTH} characters`,
      ],
    },
    label: {
      type: String,
      default: '',
      maxlength: [
        MAX_COMPONENT_LABEL_LENGTH,
        `Component label cannot exceed ${MAX_COMPONENT_LABEL_LENGTH} characters`,
      ],
    },
    type: {
      type: String,
      enum: Object.values(COMPONENT_TYPE),
      default: COMPONENT_TYPE.EARNING,
    },
    calculation: {
      type: String,
      enum: Object.values(CALCULATION),
      default: CALCULATION.FIXED,
    },
    value: { type: Number, default: 0, min: 0 },
    taxable: { type: Boolean, default: true },
    isResidual: { type: Boolean, default: false },
  },
  { _id: false },
);

const fbpDeclarationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    fbpConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FbpConfig',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    proposedComponents: [proposedComponentSchema],
    totalCtc: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

fbpDeclarationSchema.index({ employeeId: 1, fbpConfigId: 1 }, { unique: true });
fbpDeclarationSchema.index({ tenantId: 1, status: 1 });

fbpDeclarationSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('FbpDeclaration', fbpDeclarationSchema);
