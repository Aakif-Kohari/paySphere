/**
 * Mongoose Encrypt Plugin
 *
 * Transparently encrypts specified schema fields before `save` and decrypts
 * them after `find` / `findOne` / `findById` / `findOneAndUpdate`.
 *
 * Apply it to any schema in one line:
 *   schema.plugin(encryptPlugin, { fields: ['bankAccount', 'panNumber'] });
 *
 * The plugin deliberately avoids touching fields that have not been modified
 * on an update (`this.isModified(field)`) so that unrelated partial updates
 * never double-encrypt a field.
 */
'use strict';

const { encrypt, decrypt } = require('../services/encryption.service');

/**
 * @param {import('mongoose').Schema} schema
 * @param {{ fields?: string[] }}     options
 */
function encryptPlugin(schema, options = {}) {
  const fields = options.fields || [];
  if (!fields.length) return;

  // Encrypt before every save
  schema.pre('save', function preSave(next) {
    for (const field of fields) {
      if (this.isModified(field) && this[field] != null) {
        this[field] = encrypt(String(this[field]));
      }
    }
    next();
  });

  // Decrypt post-find helpers
  function decryptDoc(doc) {
    if (!doc) return;
    for (const field of fields) {
      if (doc[field] != null) {
        doc[field] = decrypt(String(doc[field]));
      }
    }
  }

  schema.post('find',             (docs)  => { if (Array.isArray(docs)) docs.forEach(decryptDoc); });
  schema.post('findOne',          decryptDoc);
  schema.post('findById',         decryptDoc);
  schema.post('findOneAndUpdate', decryptDoc);
}

module.exports = encryptPlugin;
