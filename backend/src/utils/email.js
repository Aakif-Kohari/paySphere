const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('./logger');

const sendEmail = async ({ to, subject, text, html, attachments }) => {
  const smtpHost = process.env.SMTP_HOST;
  const frontendUrl = process.env.FRONTEND_URL;

  if (!smtpHost && !frontendUrl) {
    logger.info('Email fallback - neither SMTP nor FRONTEND_URL configured', { to, subject, attachmentCount: attachments?.length || 0 });
    return { success: true, logged: true };
  }

  const formattedAttachments = attachments?.map((att) => {
    let content = att.content;
    if (Buffer.isBuffer(content)) {
      content = content.toString('base64');
    }
    return {
      filename: att.filename,
      content,
    };
  });

  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"PaySphere" <no-reply@paysphere.com>',
        to,
        subject,
        text,
        html,
      };

      if (formattedAttachments && formattedAttachments.length > 0) {
        mailOptions.attachments = formattedAttachments;
      }

      await transporter.sendMail(mailOptions);
      logger.info(`Email sent via SMTP to ${to}`, { to, subject });
      return { success: true, smtp: true };
    } catch (error) {
      logger.warn('SMTP send failed, trying proxy fallback', { to, subject, reason: error.message });
    }
  }

  if (frontendUrl) {
    try {
      const proxyUrl = `${frontendUrl.replace(/\/+$/, '')}/api/send-email`;
      const secret = process.env.EMAIL_PROXY_SECRET;
      const headers = {};
      if (secret) {
        headers['Authorization'] = `Bearer ${secret}`;
      }

      const response = await axios.post(proxyUrl, {
        to,
        subject,
        text,
        html,
        attachments: formattedAttachments,
      }, { headers });

      if (response.status === 200) {
        logger.info(`Email proxied to Vercel for ${to}`, { to, subject });
        return { success: true, proxied: true };
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      const message = error.response?.data?.error || error.message;
      logger.warn('Email Vercel proxy unavailable, falling back to console', { to, subject, reason: message });
      return { success: true, logged: true };
    }
  }

  logger.info('Email fallback - logging to console', { to, subject, attachmentCount: formattedAttachments?.length || 0 });
  return { success: true, logged: true };
};

module.exports = { sendEmail };
