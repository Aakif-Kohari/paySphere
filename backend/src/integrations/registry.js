/**
 * Integration Registry
 *
 * Singleton that maps provider name strings to their adapter classes.
 * Validates adapters with `instanceof BaseIntegration` at registration.
 *
 * Built-in adapters: bamboohr, workday.
 * Add more by calling `registry.register('adp', AdpIntegration)`.
 */
'use strict';

const BaseIntegration      = require('./base.integration');
const BambooHRIntegration  = require('./bamboohr.integration');
const WorkdayIntegration   = require('./workday.integration');
const logger               = require('../utils/logger');

const _adapters = new Map();

function register(name, AdapterClass) {
  if (!(AdapterClass.prototype instanceof BaseIntegration)) {
    throw new TypeError(`${AdapterClass.name} must extend BaseIntegration`);
  }
  _adapters.set(name.toLowerCase(), AdapterClass);
  logger.info('HRMS integration adapter registered', { name });
}

/**
 * Instantiate the adapter for a given provider with the supplied config.
 *
 * @param {string} provider  e.g. 'bamboohr'
 * @param {object} config    Decrypted tenant credentials.
 * @returns {BaseIntegration}
 */
function getAdapter(provider, config) {
  const Cls = _adapters.get(provider.toLowerCase());
  if (!Cls) throw new Error(`No adapter registered for provider "${provider}"`);
  return new Cls(config);
}

function listProviders() { return Array.from(_adapters.keys()); }

// Register built-in adapters
register('bamboohr', BambooHRIntegration);
register('workday',  WorkdayIntegration);

module.exports = { register, getAdapter, listProviders };
