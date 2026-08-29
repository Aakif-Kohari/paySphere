'use strict';
const cron = require('node-cron');
const IntegrationConfig = require('../models/integrationConfig.model');
const { syncTenant } = require('../services/integrationSync.service');
const logger = require('../utils/logger');

function startIntegrationSyncJob() {
  // Run daily at 02:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Scheduled daily HRMS integration sync started');
    try {
      const activeConfigs = await IntegrationConfig.find({ isActive: true });
      for (const config of activeConfigs) {
        try {
          const result = await syncTenant(config);
          logger.info(`Scheduled sync successful for tenant ${config.tenantId} using provider ${config.provider}`, { result });
        } catch (err) {
          logger.error(`Scheduled sync failed for tenant ${config.tenantId} using provider ${config.provider}`, { error: err.message });
        }
      }
    } catch (err) {
      logger.error('Scheduled HRMS sync job failed', { error: err.message });
    }
  });
  logger.info('Integration Sync Cron Job registered successfully.');
}

module.exports = { startIntegrationSyncJob };