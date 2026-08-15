const mongoose = require('mongoose');

/**
 * Generic Base Repository class implementing core CRUD operations on Mongoose models.
 * Allows easy mocking of database queries in unit and integration tests.
 */
class BaseRepository {
  /**
   * @param {mongoose.Model} model - Mongoose model
   */
  constructor(model) {
    if (!model) {
      throw new Error('Mongoose model is required to instantiate BaseRepository');
    }
    this.model = model;
  }

  /**
   * Fetch documents matching filter.
   */
  async find(filter = {}, options = {}) {
    let query = this.model.find(filter);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options.skip !== undefined) {
      query = query.skip(options.skip);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query;
  }

  /**
   * Fetch a single document matching filter.
   */
  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query;
  }

  /**
   * Fetch document by ID.
   */
  async findById(id, options = {}) {
    let query = this.model.findById(id);
    
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.populate) {
      query = query.populate(options.populate);
    }
    if (options.lean) {
      query = query.lean();
    }
    
    return query;
  }

  /**
   * Create and save a new document.
   */
  async create(data) {
    const doc = new this.model(data);
    return doc.save();
  }

  /**
   * Update document by ID.
   */
  async updateById(id, updateData, options = {}) {
    const opt = { new: true, runValidators: true, ...options };
    return this.model.findByIdAndUpdate(id, updateData, opt);
  }

  /**
   * Update single document matching filter.
   */
  async updateOne(filter, updateData, options = {}) {
    const opt = { new: true, runValidators: true, ...options };
    return this.model.findOneAndUpdate(filter, updateData, opt);
  }

  /**
   * Delete document by ID.
   */
  async deleteById(id, options = {}) {
    return this.model.findByIdAndDelete(id, options);
  }

  /**
   * Delete multiple documents matching filter.
   */
  async deleteMany(filter = {}, options = {}) {
    return this.model.deleteMany(filter, options);
  }

  /**
   * Count documents matching filter.
   */
  async countDocuments(filter = {}) {
    return this.model.countDocuments(filter);
  }
}

module.exports = BaseRepository;
