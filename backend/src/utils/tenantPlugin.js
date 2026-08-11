'use strict';
const mongoose = require('mongoose');
const logger   = require('./logger');
function tenantPlugin(schema, options = {}) {
  const required = options.required !== false;
  if (!schema.path('tenantId')) {
    schema.add({ tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required, index: true } });
  }
  schema.pre('save', function(next) {
    if (required && !this.tenantId) { const e = new Error('Document cannot be saved without tenantId'); e.status=400; return next(e); }
    next();
  });
  if (process.env.NODE_ENV !== 'production') {
    schema.pre('find', function() {
      if (!this.getFilter().tenantId) logger.warn('Unscoped find() — missing tenantId', { filter: JSON.stringify(this.getFilter()) });
    });
  }
}
module.exports = { tenantPlugin };