const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
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
  }
}, { timestamps: true });

module.exports = mongoose.model("Permission", permissionSchema);
