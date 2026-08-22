const mongoose = require('mongoose');

const pensionPolicySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    region: { type: String, required: true, trim: true }, // e.g. 'US', 'IN', 'UK'
    planName: { type: String, required: true, trim: true }, // e.g. '401(k)', 'Provident Fund'
    
    employeeContributionRate: { type: Number, required: true, min: 0, max: 100 }, // Percentage of base
    employerContributionRate: { type: Number, required: true, min: 0, max: 100 }, // Percentage of base
    
    monthlySalaryCap: { type: Number, default: null }, // e.g. INR 15,000 for India PF
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const employeePensionSettingSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true, index: true },
    pensionPolicyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PensionPolicy', required: true },
    
    isEnrolled: { type: Boolean, default: true },
    customEmployeeContributionRate: { type: Number, default: null, min: 0, max: 100 },
    customEmployerContributionRate: { type: Number, default: null, min: 0, max: 100 }
  },
  { timestamps: true }
);

module.exports = {
  PensionPolicy: mongoose.model('PensionPolicy', pensionPolicySchema),
  EmployeePensionSetting: mongoose.model('EmployeePensionSetting', employeePensionSettingSchema)
};
