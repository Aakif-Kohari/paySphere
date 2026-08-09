const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Examples: 'READ_EMPLOYEE', 'WRITE_EMPLOYEE', 'READ_PAYROLL', 'WRITE_PAYROLL', 'READ_REPORT'
    },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

permissionSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Permission', permissionSchema);
