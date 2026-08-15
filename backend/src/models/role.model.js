const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
  },
  { timestamps: true },
);

roleSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Role', roleSchema);
