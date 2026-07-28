const nodemailer = require('nodemailer');
const logger = require('./logger');

const sendEmail = async ({ to, subject, text, html, attachments }) => {
  const smtpHost = process.env.SMTP_HOST;

  if (!smtpHost) {
    logger.error('Email delivery failed: SMTP_HOST not configured', { to, subject });
    return { success: false, error: 'SMTP configuration missing' };
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
    logger.error('Email delivery failed', { to, subject, error: error.message });
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
