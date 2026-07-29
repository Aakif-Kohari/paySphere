const axios = require('axios');

jest.mock('axios');

const { sendEmail } = require('../email');

describe('sendEmail', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return success when proxy returns 200', async () => {
    process.env.FRONTEND_URL = 'https://example.com';
    axios.post.mockResolvedValue({ status: 200 });

    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Hello' });

    expect(result.success).toBe(true);
    expect(result.proxied).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://example.com/api/send-email',
      expect.objectContaining({ to: 'test@example.com', subject: 'Test' }),
      expect.any(Object),
    );
  });

  test('should return failure when proxy throws an error', async () => {
    process.env.FRONTEND_URL = 'https://example.com';
    axios.post.mockRejectedValue({ response: { data: { error: 'Proxy timeout' } } });

    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Hello' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Proxy timeout');
  });

  test('should return failure when proxy returns non-200 status', async () => {
    process.env.FRONTEND_URL = 'https://example.com';
    axios.post.mockResolvedValue({ status: 500 });

    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Hello' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unexpected response status: 500');
  });

  test('should return failure on network error', async () => {
    process.env.FRONTEND_URL = 'https://example.com';
    axios.post.mockRejectedValue(new Error('Network Error'));

    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Hello' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network Error');
  });

  test('should return success with logged flag when FRONTEND_URL is not configured', async () => {
    delete process.env.FRONTEND_URL;

    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Hello' });

    expect(result.success).toBe(true);
    expect(result.logged).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('should include Authorization header when EMAIL_PROXY_SECRET is set', async () => {
    process.env.FRONTEND_URL = 'https://example.com';
    process.env.EMAIL_PROXY_SECRET = 'my-secret';
    axios.post.mockResolvedValue({ status: 200 });

    await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'Hello' });

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-secret' }),
      }),
    );
  });

  test('should convert Buffer attachments to base64', async () => {
    process.env.FRONTEND_URL = 'https://example.com';
    axios.post.mockResolvedValue({ status: 200 });
    const buffer = Buffer.from('file content');

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello',
      attachments: [{ filename: 'test.pdf', content: buffer }],
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        attachments: [{ filename: 'test.pdf', content: buffer.toString('base64') }],
      }),
      expect.any(Object),
    );
  });
});
