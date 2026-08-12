const request = require('supertest');
const express = require('express');
const axios = require('axios');
const emailController = require('../email.controller');
const logger = require('../../utils/logger');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('axios');

const app = express();
app.use(express.json());
app.post('/api/email/webhooks', emailController.handleEmailWebhook);

describe('Email Webhook Receiver Controller (#812)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SendGrid Webhook Events', () => {
    it('successfully processes array of SendGrid delivery events', async () => {
      const payload = [
        {
          email: 'user1@example.com',
          event: 'delivered',
          sg_message_id: 'msg1',
        },
        {
          email: 'user2@example.com',
          event: 'bounce',
          reason: '550 User unknown',
          sg_message_id: 'msg2',
        },
      ];

      const res = await request(app)
        .post('/api/email/webhooks?provider=sendgrid')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify delivery logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('SendGrid webhook status update: delivered'),
        expect.objectContaining({ email: 'user1@example.com' })
      );

      // Verify bounce warning logging
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SendGrid delivery failure warning for user2@example.com'),
        expect.objectContaining({ event: 'bounce', reason: '550 User unknown' })
      );
    });

    it('returns 400 if the payload is not an array', async () => {
      const res = await request(app)
        .post('/api/email/webhooks?provider=sendgrid')
        .send({ event: 'delivered' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('webhook payload must be an array');
    });
  });

  describe('AWS SES SNS Webhook Events', () => {
    it('auto-confirms SNS subscription confirmation requests', async () => {
      const payload = {
        Type: 'SubscriptionConfirmation',
        SubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=mock-topic',
      };

      axios.get.mockResolvedValue({ status: 200 });

      const res = await request(app)
        .post('/api/email/webhooks?provider=ses')
        .set('x-amz-sns-message-type', 'SubscriptionConfirmation')
        .send(payload);

      expect(res.status).toBe(200);
      expect(axios.get).toHaveBeenCalledWith(payload.SubscribeURL);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('AWS SES SNS webhook SubscriptionConfirmation request received'),
        expect.any(Object)
      );
    });

    it('processes SES event notifications and logs bounces', async () => {
      const innerMessage = {
        eventType: 'Bounce',
        bounce: {
          bounceType: 'Permanent',
          bouncedRecipients: [{ emailAddress: 'bounced@example.com' }],
        },
        mail: {
          messageId: 'ses-msg-123',
          destination: ['bounced@example.com'],
        },
      };

      const payload = {
        Type: 'Notification',
        MessageId: 'msg-id',
        Message: JSON.stringify(innerMessage),
      };

      const res = await request(app)
        .post('/api/email/webhooks?provider=ses')
        .send(payload);

      expect(res.status).toBe(200);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('AWS SES webhook status update: Bounce'),
        expect.objectContaining({
          eventType: 'Bounce',
          destination: ['bounced@example.com'],
          messageId: 'ses-msg-123',
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('AWS SES delivery failure warning for bounced@example.com'),
        expect.any(Object)
      );
    });
  });
});
