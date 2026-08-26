const mongoose = require('mongoose');

const salaryAdjustmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    
    effectiveMonth: { type: Number, required: true }, // 1-12
    effectiveYear: { type: Number, required: true },

    oldSalaryRate: { type: Number, required: true },
    newSalaryRate: { type: Number, required: true },
    calculatedDelta: { type: Number, required: true },

    status: { type: String, enum: ['Pending', 'Processed'], default: 'Pending', index: true },
    payrollMonth: { type: Number },
    payrollYear: { type: Number }
  },
  { timestamps: true }
);

module.exports = {
  SalaryAdjustment: mongoose.model('SalaryAdjustment', salaryAdjustmentSchema)
};
