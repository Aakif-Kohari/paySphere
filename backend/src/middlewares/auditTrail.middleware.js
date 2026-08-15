const { getAuditContext } = require('../utils/auditContext');
const { createAuditLog } = require('../services/audit.service');

function getResourceType(modelName) {
  if (modelName === 'PayrollUpdate') return 'Payroll';
  return modelName;
}

function getAction(resourceType, operation) {
  const resourceUpper = resourceType.toUpperCase();
  return `${resourceUpper}_${operation}`;
}

/**
 * Mongoose plugin to automatically intercept and log all write/update/delete operations on sensitive resources (#724).
 */
function auditTrailPlugin(schema) {
  // Track document isNew state before save
  schema.pre('save', function () {
    this.$wasNew = this.isNew;
  });

  // Intercept document saves (Create & Update via doc.save())
  schema.post('save', async function (doc) {
    const context = getAuditContext();
    const req = context?.req;
    if (!req) return;

    const userId = req.userId;
    if (!userId) return;

    const isCreate = doc.$wasNew || false;
    const resourceType = getResourceType(doc.constructor.modelName);
    const action = getAction(resourceType, isCreate ? 'CREATE' : 'UPDATE');

    await createAuditLog({
      userId,
      action,
      resourceType,
      resourceIds: [doc._id],
      req,
    });
  });

  // Capture IDs before update query runs
  const preUpdate = async function (next) {
    try {
      const docs = await this.model.find(this.getQuery()).select('_id').lean();
      this._auditIds = docs.map((d) => d._id);
    } catch (err) {
      // Safe fallback
    }
    if (typeof next === 'function') next();
  };

  // Log update query execution
  const postUpdate = async function (res) {
    const context = getAuditContext();
    const req = context?.req;
    if (!req) return;

    const userId = req.userId;
    if (!userId) return;

    const resourceType = getResourceType(this.model.modelName);
    const action = getAction(resourceType, 'UPDATE');

    if (this._auditIds && this._auditIds.length > 0) {
      await createAuditLog({
        userId,
        action,
        resourceType,
        resourceIds: this._auditIds,
        req,
      });
    }
  };

  schema.pre('updateOne', preUpdate);
  schema.pre('updateMany', preUpdate);
  schema.pre('findOneAndUpdate', preUpdate);
  schema.pre('update', preUpdate);

  schema.post('updateOne', postUpdate);
  schema.post('updateMany', postUpdate);
  schema.post('findOneAndUpdate', postUpdate);
  schema.post('update', postUpdate);

  // Capture IDs before delete query runs
  const preDelete = async function (next) {
    try {
      const docs = await this.model.find(this.getQuery()).select('_id').lean();
      this._auditIds = docs.map((d) => d._id);
    } catch (err) {
      // Safe fallback
    }
    if (typeof next === 'function') next();
  };

  // Log delete query execution
  const postDelete = async function (res) {
    const context = getAuditContext();
    const req = context?.req;
    if (!req) return;

    const userId = req.userId;
    if (!userId) return;

    const resourceType = getResourceType(this.model.modelName);
    const action = getAction(resourceType, 'DELETE');

    if (this._auditIds && this._auditIds.length > 0) {
      await createAuditLog({
        userId,
        action,
        resourceType,
        resourceIds: this._auditIds,
        req,
      });
    }
  };

  schema.pre('deleteOne', preDelete);
  schema.pre('deleteMany', preDelete);
  schema.pre('findOneAndDelete', preDelete);
  schema.pre('remove', preDelete);

  schema.post('deleteOne', postDelete);
  schema.post('deleteMany', postDelete);
  schema.post('findOneAndDelete', postDelete);
  schema.post('remove', postDelete);
}

module.exports = auditTrailPlugin;
