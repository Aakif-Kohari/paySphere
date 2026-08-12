const logger = require('../utils/logger');
const axios = require('axios');

exports.handleEmailWebhook = async (req, res, next) => {
  try {
    const provider = req.query.provider || 'sendgrid';

    if (provider === 'ses') {
      // Handle AWS SES SNS Webhooks
      const messageType = req.headers['x-amz-sns-message-type'];

      if (messageType === 'SubscriptionConfirmation') {
        const snsPayload = req.body;
        const subscribeUrl = snsPayload.SubscribeURL;
        logger.info(`AWS SES SNS webhook SubscriptionConfirmation request received`, { subscribeUrl });

        if (subscribeUrl) {
          try {
            await axios.get(subscribeUrl);
            logger.info('SES SNS subscription confirmed successfully');
          } catch (err) {
            logger.error('Failed to auto-confirm SES SNS subscription', { error: err.message });
          }
        }
        return res.status(200).send('Subscription Confirmation Handled');
      }

      // Handle actual SES event notifications
      let payload = req.body;
      if (typeof payload.Message === 'string') {
        try {
          payload = JSON.parse(payload.Message);
        } catch {
          // Keep as string
        }
      }

      if (payload && payload.eventType) {
        const eventType = payload.eventType;
        const mail = payload.mail || {};
        const destination = mail.destination || [];

        logger.info(`AWS SES webhook status update: ${eventType}`, {
          eventType,
          destination,
          messageId: mail.messageId,
        });

        if (eventType === 'Bounce' || eventType === 'Complaint') {
          logger.warn(`AWS SES delivery failure warning for ${destination.join(', ')}`, {
            eventType,
            bounce: payload.bounce,
          });
        }
      }
    } else {
      // Handle SendGrid Webhooks
      const events = req.body;
      if (!Array.isArray(events)) {
        return res.status(400).json({ message: 'SendGrid webhook payload must be an array' });
      }

      for (const event of events) {
        logger.info(`SendGrid webhook status update: ${event.event}`, {
          email: event.email,
          event: event.event,
          sg_message_id: event.sg_message_id,
        });

        if (event.event === 'bounce' || event.event === 'dropped') {
          logger.warn(`SendGrid delivery failure warning for ${event.email}`, {
            event: event.event,
            reason: event.reason,
          });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
