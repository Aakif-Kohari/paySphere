const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { runDatabaseBackupJob } = require('../backup.job');

// Mock mongoose
jest.mock('mongoose', () => {
  const mockFind = {
    toArray: jest.fn().mockResolvedValue([
      { _id: 'doc1', name: 'John Doe' },
      { _id: 'doc2', name: 'Jane Doe' },
    ]),
  };
  const mockCollection = {
    find: jest.fn().mockReturnValue(mockFind),
  };
  return {
    connection: {
      db: {
        listCollections: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { name: 'employees' },
            { name: 'payrolls' },
          ]),
        }),
        collection: jest.fn().mockReturnValue(mockCollection),
      },
    },
  };
});

// Mock S3 Client
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((params) => params),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Database Backup Cron Job (#1047)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up backups dir if created in test
    const backupDir = path.join(__dirname, '../../../backups');
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(backupDir, file));
        } catch (err) {}
      }
    }
  });

  test('should backup locally when S3 configurations are absent', async () => {
    delete process.env.BACKUP_S3_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const result = await runDatabaseBackupJob();

    expect(result.success).toBe(true);
    expect(result.fileName).toBeDefined();

    // Verify local backup zip file exists
    const backupDir = path.join(__dirname, '../../../backups');
    const filePath = path.join(backupDir, result.fileName);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('should upload to S3 and delete local file when S3 configurations are present', async () => {
    process.env.BACKUP_S3_BUCKET = 'mock-backup-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'mock-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret-key';
    process.env.AWS_REGION = 'us-west-2';

    const result = await runDatabaseBackupJob();

    expect(result.success).toBe(true);
    expect(result.fileName).toBeDefined();

    // S3 client send should be called
    expect(mockSend).toHaveBeenCalled();

    // Verify local file is cleaned up after upload
    const backupDir = path.join(__dirname, '../../../backups');
    const filePath = path.join(backupDir, result.fileName);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
