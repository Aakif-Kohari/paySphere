const nodemailer = require('nodemailer');
const { sendEmail } = require('../email');

jest.mock('nodemailer');
jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('sendEmail', () => {
  const originalEnv = process.env;
  let mockSendMail;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockSendMail = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({
      sendMail: mockSendMail,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return failure when SMTP_HOST is not configured', async () => {
    delete process.env.SMTP_HOST;
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP configuration missing');
  });

  test('should send email successfully via nodemailer', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.smtp).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com', subject: 'Test' }),
    );
  });

  test('should handle nodemailer sendMail failure', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    mockSendMail.mockRejectedValue(new Error('SMTP Error'));

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP Error');
  });

  test('should convert Buffer attachments to base64', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    const buffer = Buffer.from('file content');

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello',
      attachments: [{ filename: 'test.pdf', content: buffer }],
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          { filename: 'test.pdf', content: buffer.toString('base64') },
        ],
      }),
    );
  });
});
