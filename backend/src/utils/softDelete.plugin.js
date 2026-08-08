const mongoose = require('mongoose');

module.exports = function softDeletePlugin(schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  });

  const excludeDeleted = function (next) {
    // Skip if includeDeleted option is set
    if (this.getOptions && this.getOptions().includeDeleted) {
      if (typeof next === 'function') return next();
      return;
    }

    if (this instanceof mongoose.Aggregate) {
      this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
      if (typeof next === 'function') return next();
      return;
    }

    const query = this.getQuery();

    // Check if the query itself is specifically filtering by isDeleted or deletedAt
    if (query.isDeleted !== undefined || query.deletedAt !== undefined) {
      if (typeof next === 'function') return next();
      return;
    }

    this.where({ isDeleted: { $ne: true } });
    if (typeof next === 'function') next();
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('count', excludeDeleted);
  schema.pre('aggregate', excludeDeleted);

  // Helper method for soft deleting
  schema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  // Helper method for restoring
  schema.methods.restore = async function () {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  };
};
