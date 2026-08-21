const mongoose = require('mongoose');

const clearanceStepSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['Pending', 'Cleared', 'Rejected'],
    default: 'Pending'
  },
  clearedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  clearedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, { _id: false });

const exitClearanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    unique: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Rejected'],
    default: 'Pending'
  },
  itClearance: {
    type: clearanceStepSchema,
    default: () => ({ status: 'Pending' })
  },
  hrClearance: {
    type: clearanceStepSchema,
    default: () => ({ status: 'Pending' })
  },
  adminClearance: {
    type: clearanceStepSchema,
    default: () => ({ status: 'Pending' })
  },
  hasTrainingAgreement: {
    type: Boolean,
    default: false
  },
  trainingClawbackAmount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('ExitClearance', exitClearanceSchema);
