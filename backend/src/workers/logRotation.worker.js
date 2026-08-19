const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Readable } = require('stream');
const WebhookDelivery = require('../models/webhookDelivery.model');
const { uploadToS3 } = require('../utils/s3Uploader');
const logger = require('../utils/logger');

/**
 * Daily Webhook Log Rotation Worker.
 * Fetches WebhookDelivery logs older than 30 days, compresses them via gzip stream,
 * uploads to S3, and deletes the purged logs from the primary DB.
 */
async function rotateWebhookLogs() {
  logger.info('Starting daily webhook log rotation worker...');

  const daysThreshold = 30;
  const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveFileName = `webhook-logs-${timestamp}.json.gz`;

  // 1. Fetch matching historical logs
  const logs = await WebhookDelivery.find({ createdAt: { $lt: cutoffDate } }).lean();
  if (logs.length === 0) {
    logger.info('No webhook logs older than 30 days found to rotate.');
    return { success: true, rotatedCount: 0 };
  }

  logger.info(`Found ${logs.length} webhook logs to rotate.`);

  // 2. Prepare local archives path
  const archiveDir = path.join(__dirname, '../../webhook-archives');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  const localFilePath = path.join(archiveDir, archiveFileName);

  // 3. Serialize and compress logs into a Gzip Stream
  const readable = Readable.from(logs.map(log => JSON.stringify(log) + '\n'));
  const gzipStream = readable.pipe(zlib.createGzip());

  // Buffer the stream to write locally and/or upload to S3
  const chunks = [];
  const bufferPromise = new Promise((resolve, reject) => {
    gzipStream.on('data', chunk => chunks.push(chunk));
    gzipStream.on('end', () => resolve(Buffer.concat(chunks)));
    gzipStream.on('error', reject);
  });

  let compressedBuffer;
  try {
    compressedBuffer = await bufferPromise;
  } catch (error) {
    logger.error('Failed to compress webhook logs', { error: error.message });
    throw error;
  }

  // Write file locally first for safety
  try {
    fs.writeFileSync(localFilePath, compressedBuffer);
    logger.info(`Successfully saved webhook logs archive locally: ${localFilePath}`);
  } catch (error) {
    logger.error('Failed to save webhook logs locally', { error: error.message });
    throw error;
  }

  // 4. Upload to S3 if configured
  let uploadedToS3 = false;
  const bucketName = process.env.AWS_S3_BUCKET;
  if (bucketName && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      await uploadToS3(bucketName, archiveFileName, compressedBuffer);
      uploadedToS3 = true;
      logger.info(`Successfully uploaded archive to S3: ${archiveFileName}`);
    } catch (err) {
      logger.error('Failed to upload log archive to S3, keeping local copy', { error: err.message });
    }
  } else {
    logger.warn('AWS S3 credentials missing. Log archive saved locally in webhook-archives/.');
  }

  // 5. Purge logs from primary database
  try {
    const deletedIds = logs.map(l => l._id);
    const deleteResult = await WebhookDelivery.deleteMany({ _id: { $in: deletedIds } });
    logger.info(`Purged ${deleteResult.deletedCount} rotated logs from MongoDB.`);
  } catch (error) {
    logger.error('Failed to purge rotated logs from database', { error: error.message });
    throw error;
  }

  return {
    success: true,
    rotatedCount: logs.length,
    uploadedToS3,
    localPath: localFilePath
  };
}

module.exports = {
  rotateWebhookLogs
};
