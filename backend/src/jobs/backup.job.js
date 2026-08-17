const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const logger = require('../utils/logger');

// Dynamically require S3 SDK to prevent require failures if not fully installed during dev/test setups
let S3Client = null;
let PutObjectCommand = null;
try {
  const s3Sdk = require('@aws-sdk/client-s3');
  S3Client = s3Sdk.S3Client;
  PutObjectCommand = s3Sdk.PutObjectCommand;
} catch (err) {
  logger.warn('AWS S3 SDK not found. Offline database backup mode only.', { error: err.message });
}

/**
 * Runs the database backup job.
 * Dumps all collections as JSON files into a ZIP archive,
 * and uploads the ZIP to S3 if configured, falling back to a local folder.
 */
async function runDatabaseBackupJob() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../../backups');
  
  // Ensure the local backup folder exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFileName = `backup-${timestamp}.zip`;
  const backupFilePath = path.join(backupDir, backupFileName);

  logger.info('Starting automated database backup job...', { backupFileName });

  // 1. Open a write stream for the ZIP file
  const output = fs.createWriteStream(backupFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const archivePromise = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(output);

  try {
    // 2. Fetch all collections from MongoDB
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.info(`Found ${collections.length} collections to dump.`);

    for (const col of collections) {
      const colName = col.name;
      const documents = await mongoose.connection.db.collection(colName).find({}).toArray();
      const colData = JSON.stringify(documents, null, 2);
      
      // Append collection file to the ZIP archive
      archive.append(colData, { name: `${colName}.json` });
    }

    // 3. Finalize the ZIP archive
    await archive.finalize();
    await archivePromise;

    const fileStats = fs.statSync(backupFilePath);
    logger.info('Database backup ZIP file created successfully.', { 
      filePath: backupFilePath, 
      sizeBytes: fileStats.size 
    });

    // 4. Check for AWS S3 upload config
    const s3Bucket = process.env.BACKUP_S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (S3Client && s3Bucket && accessKeyId && secretAccessKey) {
      logger.info('Uploading backup ZIP to S3...', { bucket: s3Bucket, key: backupFileName });
      
      const s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey }
      });

      const fileContent = fs.readFileSync(backupFilePath);
      const uploadParams = {
        Bucket: s3Bucket,
        Key: `backups/${backupFileName}`,
        Body: fileContent,
        ContentType: 'application/zip'
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      logger.info('Database backup successfully uploaded to S3.', { bucket: s3Bucket, key: backupFileName });

      // Clean up the local file since S3 upload is complete
      fs.unlinkSync(backupFilePath);
      logger.info('Cleaned up local backup file after S3 upload.');
    } else {
      logger.warn('S3 configurations missing or SDK not loaded. Retaining backup file locally.', {
        hasS3Bucket: !!s3Bucket,
        hasS3Client: !!S3Client,
        localFilePath: backupFilePath
      });
    }

    return { success: true, fileName: backupFileName };
  } catch (error) {
    logger.error('Database backup job failed', { error: error.message });
    // Attempt clean up of corrupted file if it exists
    if (fs.existsSync(backupFilePath)) {
      try {
        fs.unlinkSync(backupFilePath);
      } catch (err) {
        // Ignore unlink error
      }
    }
    throw error;
  }
}

module.exports = { runDatabaseBackupJob };
