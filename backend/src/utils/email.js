const logger = require('./logger');

// Dynamically load SDKs so the application doesn't crash if they are not installed locally during dev/test
let sgMail = null;
let SESClient = null;
let SendEmailCommand = null;

try {
  sgMail = require('@sendgrid/mail');
} catch (e) {
  logger.warn('SendGrid SDK not found in node_modules');
}

try {
  const sesSdk = require('@aws-sdk/client-ses');
  SESClient = sesSdk.SESClient;
  SendEmailCommand = sesSdk.SendEmailCommand;
} catch (e) {
  logger.warn('AWS SES SDK not found in node_modules');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Robust retry mechanism with exponential backoff and jitter
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      const backoff = delay * Math.pow(2, attempt) + Math.random() * 200;
      logger.warn(`Email send attempt ${attempt} failed. Retrying in ${Math.round(backoff)}ms...`, { error: err.message });
      await sleep(backoff);
    }
  }
};

const sendEmailSendGrid = async ({ to, subject, text, html, attachments }) => {
  if (!sgMail) {
    throw new Error('SendGrid SDK is not loaded');
  }
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not configured');
  }
  sgMail.setApiKey(apiKey);

  const from = process.env.EMAIL_FROM || 'no-reply@paysphere.com';
  const msg = {
    to,
    from,
    subject,
    text,
    html,
  };

  if (attachments && attachments.length > 0) {
    msg.attachments = attachments.map((att) => {
      let content = att.content;
      if (Buffer.isBuffer(content)) {
        content = content.toString('base64');
      }
      return {
        filename: att.filename,
        content,
        type: att.type || 'application/octet-stream',
        disposition: 'attachment',
      };
    });
  }

  await sgMail.send(msg);
  logger.info(`Email successfully sent via SendGrid to ${to}`, { to, subject });
};

const sendEmailSES = async ({ to, subject, text, html }) => {
  if (!SESClient || !SendEmailCommand) {
    throw new Error('AWS SES SDK is not loaded');
  }
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials missing for SES');
  }

  const sesClient = new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const from = process.env.EMAIL_FROM || 'no-reply@paysphere.com';
  const params = {
    Source: from,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
      },
      Body: {
        Text: {
          Data: text,
        },
        Html: {
          Data: html,
        },
      },
    },
  };

  const command = new SendEmailCommand(params);
  await sesClient.send(command);
  logger.info(`Email successfully sent via AWS SES to ${to}`, { to, subject });
};

const sendEmail = async (options) => {
  const provider = (process.env.EMAIL_PROVIDER || 'sendgrid').toLowerCase();
  
  const sendFn = async () => {
    if (provider === 'ses') {
      await sendEmailSES(options);
    } else {
      await sendEmailSendGrid(options);
    }
  };

  try {
    await retryWithBackoff(sendFn, 3, 1000);
    return { success: true, provider };
  } catch (error) {
    logger.error('All email delivery attempts failed', {
      provider,
      to: options.to,
      subject: options.subject,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
