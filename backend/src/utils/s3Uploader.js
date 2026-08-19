const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

/**
 * Uploads a file, buffer, or stream to S3.
 * 
 * @param {string} bucketName - Name of target S3 bucket
 * @param {string} key - S3 object key/path
 * @param {Buffer|ReadableStream} body - File payload
 * @param {string} contentType - Mime-type (defaults to 'application/x-gzip')
 * @returns {Promise<Object>} AWS SDK upload response
 */
async function uploadToS3(bucketName, key, body, contentType = 'application/x-gzip') {
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS S3 configuration values.');
  }

  const s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const uploadParams = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  logger.info('Initiating AWS S3 upload...', { bucketName, key });
  const response = await s3Client.send(new PutObjectCommand(uploadParams));
  logger.info('AWS S3 upload completed successfully.', { key });

  return response;
}

module.exports = { uploadToS3 };
