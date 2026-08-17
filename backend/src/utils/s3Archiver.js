const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

/**
 * Uploads a file/buffer to S3 with Glacier cold storage class.
 * @param {string} bucketName - Name of target S3 bucket
 * @param {string} key - S3 object key/path
 * @param {Buffer} body - File payload buffer
 * @returns {Promise<Object>} AWS SDK upload response
 */
async function uploadToGlacier(bucketName, key, body) {
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS S3 Glacier configuration values.');
  }

  const s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const uploadParams = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: 'application/zip',
    StorageClass: 'GLACIER', // Ensures cold storage pricing and archival logic
  };

  logger.info('Initiating AWS S3 Glacier upload...', { bucketName, key });
  const response = await s3Client.send(new PutObjectCommand(uploadParams));
  logger.info('AWS S3 Glacier upload completed successfully.', { key });

  return response;
}

module.exports = { uploadToGlacier };
