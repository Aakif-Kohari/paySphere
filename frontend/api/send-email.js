/* eslint-env node */

import nodemailer from 'nodemailer';

/**
 * Vercel Serverless Function — Email Proxy
 *
 * Accepts a POST request containing email data and forwards it via
 * Gmail SMTP. This is used by the Render backend (which cannot make
 * outbound SMTP connections) to send password-reset and other emails.
 *
 * Endpoint: POST /api/send-email
 * Body: { to, subject, text, html }
 *
 * Environment variables (configured in Vercel dashboard):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EMAIL_FROM
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify proxy secret key if configured
  const secret = process.env.EMAIL_PROXY_SECRET;
  if (secret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== secret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid proxy secret' });
    }
  }

  const { to, subject, text, html, attachments } = req.body || {};

  // Validate required fields
  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({
      error:
        'Missing required fields: to, subject, and at least one of text or html',
    });
  }

  // Check SMTP configuration
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.log(
      '\n================================================================',
    );
    console.log(
      '📬 [VERCEL EMAIL PROXY] SMTP not configured — logging instead.',
    );
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    if (attachments && attachments.length > 0) {
      console.log(
        `Attachments: ${attachments.map((a) => a.filename).join(', ')}`,
      );
    }
    console.log(
      '----------------------------------------------------------------',
    );
    console.log(`Text:\n${text}`);
    if (html) {
      console.log(
        '----------------------------------------------------------------',
      );
      console.log(`HTML:\n${html}`);
    }
    console.log(
      '================================================================\n',
    );
    return res.status(200).json({ success: true, logged: true });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
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

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att) => {
        let contentBuffer = att.content;
        if (typeof att.content === 'string') {
          contentBuffer = Buffer.from(att.content, 'base64');
        }
        return {
          filename: att.filename,
          content: contentBuffer,
        };
      });
    }

    await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent to ${to} via Vercel Email Proxy`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Vercel Email Proxy failed:', error.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
