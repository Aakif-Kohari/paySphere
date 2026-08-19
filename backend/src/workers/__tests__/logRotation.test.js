const { rotateWebhookLogs } = require('../logRotation.worker');
const WebhookDelivery = require('../../models/webhookDelivery.model');
const { uploadToS3 } = require('../../utils/s3Uploader');
const fs = require('fs');
const path = require('path');

// Mock WebhookDelivery model
jest.mock('../../models/webhookDelivery.model', () => {
  const mockFind = jest.fn();
  const mockDeleteMany = jest.fn();
  return {
    find: mockFind,
    deleteMany: mockDeleteMany,
  };
});

// Mock S3 Uploader
jest.mock('../../utils/s3Uploader', () => ({
  uploadToS3: jest.fn().mockResolvedValue({}),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Webhook Log Rotation Worker (#1213)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should return rotatedCount = 0 when no logs older than 30 days exist', async () => {
    WebhookDelivery.find.mockResolvedValueOnce([]);

    const result = await rotateWebhookLogs();

    expect(result.rotatedCount).toBe(0);
    expect(WebhookDelivery.deleteMany).not.toHaveBeenCalled();
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  test('should compress, save locally, and upload to S3 if configured', async () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    const mockLogs = [
      { _id: 'log1', url: 'https://test1.com', isSuccess: true, createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) },
      { _id: 'log2', url: 'https://test2.com', isSuccess: false, createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    ];
    WebhookDelivery.find.mockResolvedValueOnce(mockLogs);
    WebhookDelivery.deleteMany.mockResolvedValueOnce({ deletedCount: 2 });

    const result = await rotateWebhookLogs();

    expect(result.rotatedCount).toBe(2);
    expect(result.uploadedToS3).toBe(true);
    expect(uploadToS3).toHaveBeenCalledWith(
      'test-bucket',
      expect.stringContaining('webhook-logs-'),
      expect.any(Buffer)
    );
    expect(WebhookDelivery.deleteMany).toHaveBeenCalledWith({
      _id: { $in: ['log1', 'log2'] }
    });

    // Cleanup local file
    if (fs.existsSync(result.localPath)) {
      fs.unlinkSync(result.localPath);
    }
  });

  test('should save locally and skip S3 if credentials are missing', async () => {
    delete process.env.AWS_S3_BUCKET;

    const mockLogs = [
      { _id: 'log1', url: 'https://test1.com', isSuccess: true, createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) },
    ];
    WebhookDelivery.find.mockResolvedValueOnce(mockLogs);
    WebhookDelivery.deleteMany.mockResolvedValueOnce({ deletedCount: 1 });

    const result = await rotateWebhookLogs();

    expect(result.rotatedCount).toBe(1);
    expect(result.uploadedToS3).toBe(false); // S3 skipped
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(WebhookDelivery.deleteMany).toHaveBeenCalled();

    // Verify local file exists
    expect(fs.existsSync(result.localPath)).toBe(true);

    // Cleanup local file
    fs.unlinkSync(result.localPath);
  });
});
