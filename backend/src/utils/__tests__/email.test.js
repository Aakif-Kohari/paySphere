const sgMail = require('@sendgrid/mail');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { sendEmail } = require('../email');

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

jest.mock('@aws-sdk/client-ses', () => {
  const mSend = jest.fn();
  return {
    SESClient: jest.fn().mockImplementation(() => ({
      send: mSend,
    })),
    SendEmailCommand: jest.fn().mockImplementation((params) => params),
    _mockSend: mSend,
  };
});

jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Refactored sendEmail service (#812)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SendGrid Provider', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      process.env.SENDGRID_API_KEY = 'SG.mock_api_key';
    });

    test('should fail if SENDGRID_API_KEY is not configured', async () => {
      delete process.env.SENDGRID_API_KEY;
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('SENDGRID_API_KEY is not configured');
    });

    test('should send email successfully via SendGrid', async () => {
      sgMail.send.mockResolvedValue([{}]);

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('sendgrid');
      expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.mock_api_key');
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Hello',
        })
      );
    });

    test('should convert buffer attachments to base64', async () => {
      sgMail.send.mockResolvedValue([{}]);
      const buffer = Buffer.from('file content');

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
        attachments: [{ filename: 'test.pdf', content: buffer, type: 'application/pdf' }],
      });

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              filename: 'test.pdf',
              content: buffer.toString('base64'),
              type: 'application/pdf',
            }),
          ],
        })
      );
    });

    test('should retry on failure and eventually succeed', async () => {
      // Mock failure on 1st attempt, success on 2nd attempt
      sgMail.send
        .mockRejectedValueOnce(new Error('SendGrid Temp Error'))
        .mockResolvedValueOnce([{}]);

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(sgMail.send).toHaveBeenCalledTimes(2);
    });

    test('should eventually fail after maximum retries', async () => {
      sgMail.send.mockRejectedValue(new Error('SendGrid Persistent Error'));

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid Persistent Error');
      expect(sgMail.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('AWS SES Provider', () => {
    let mockSend;

    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'ses';
      process.env.AWS_ACCESS_KEY_ID = 'mock_key_id';
      process.env.AWS_SECRET_ACCESS_KEY = 'mock_secret_key';
      mockSend = require('@aws-sdk/client-ses')._mockSend;
    });

    test('should fail if AWS credentials are not configured', async () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('AWS credentials missing for SES');
    });

    test('should send email successfully via SES', async () => {
      mockSend.mockResolvedValue({ MessageId: 'ses-message-id' });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ses');
      expect(SESClient).toHaveBeenCalled();
      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Source: 'no-reply@paysphere.com',
          Destination: { ToAddresses: ['test@example.com'] },
        })
      );
    });

    test('should retry on SES failure and fail after max retries', async () => {
      mockSend.mockRejectedValue(new Error('SES Limit Exceeded'));

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});
