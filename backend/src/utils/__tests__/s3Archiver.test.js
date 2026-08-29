const { uploadToGlacier } = require('../s3Archiver');

// Mock S3 Client
const mockSend = jest.fn().mockResolvedValue({ ETag: '"mock-etag"' });
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((params) => params),
  };
});

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('AWS S3 Glacier Archiver Utility (#1095)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should throw error if configurations are missing', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    await expect(uploadToGlacier('bucket', 'key', Buffer.from('data'))).rejects.toThrow(
      'Missing AWS S3 Glacier configuration values.'
    );
  });

  test('should successfully call S3Client send command with GLACIER storage class', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'key-id';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-key';
    process.env.AWS_REGION = 'us-west-2';

    const mockBuffer = Buffer.from('data');
    const result = await uploadToGlacier('my-archive-bucket', 'archives/arch.zip', mockBuffer);

    expect(result).toEqual({ ETag: '"mock-etag"' });
    expect(mockSend).toHaveBeenCalled();

    // Verify command parameter matches
    const putParams = mockSend.mock.calls[0][0];
    expect(putParams.Bucket).toBe('my-archive-bucket');
    expect(putParams.Key).toBe('archives/arch.zip');
    expect(putParams.Body).toBe(mockBuffer);
    expect(putParams.StorageClass).toBe('GLACIER'); // Crucial constraint check
  });
});
