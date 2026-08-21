'use strict';
const mongoose = require('mongoose');

const ipWhitelistSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    role: { type: String, required: true },
    cidrBlocks: { type: [String], default: [] },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IpWhitelist', ipWhitelistSchema);