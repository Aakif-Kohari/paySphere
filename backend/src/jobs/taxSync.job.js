const TaxJurisdiction = require('../models/taxJurisdiction.model');
const taxSyncService = require('../services/taxSync.service');
const logger = require('../utils/logger');
const { acquireLock, releaseLock } = require('../utils/lockManager');

/**
 * Scheduled job to sync all tenant regional tax slabs with external compliance APIs.
 */
async function runTaxSyncJob() {
  logger.info('Starting scheduled compliance tax sync job...');
  const now = new Date();
  const lockId = `tax_sync_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;

  // Acquire lock to prevent duplicate execution
  const lock = await acquireLock(lockId, 10 * 60 * 1000);
  if (!lock) {
    logger.info('Tax sync job skipped: lock is already held elsewhere.');
    return { success: false, reason: 'lock_held' };
  }

  try {
    // Find all distinct tenants configured with tax jurisdictions
    const tenants = await TaxJurisdiction.distinct('tenantId');
    logger.info(`Found ${tenants.length} tenants with tax jurisdictions.`);

    let totalUpdated = 0;
    for (const tenantId of tenants) {
      try {
        const result = await taxSyncService.syncRegionalTaxSlabs(tenantId, 'Scheduled');
        if (result.success) {
          totalUpdated += result.updatedCount;
        }
      } catch (err) {
        logger.error(`Failed to sync tax slabs for tenant ${tenantId}`, { error: err.message });
      }
    }

    logger.info(`Scheduled compliance tax sync complete. Updated rules: ${totalUpdated}`);
    await releaseLock(lockId);
    return { success: true, totalUpdated };
  } catch (error) {
    logger.error('Scheduled compliance tax sync job failed', { error: error.message });
    await releaseLock(lockId);
    return { success: false, error: error.message };
  }
}

module.exports = {
  runTaxSyncJob
};
