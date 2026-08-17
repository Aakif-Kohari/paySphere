const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Middleware to validate Google reCAPTCHA v3 score on auth requests.
 * Automatically bypassed in development/CI when RECAPTCHA_SECRET_KEY is absent.
 */
const validateRecaptcha = async (req, res, next) => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    logger.warn('reCAPTCHA validation skipped: RECAPTCHA_SECRET_KEY is not defined.');
    return next();
  }

  const token = req.body.recaptchaToken;
  if (!token) {
    logger.warn('reCAPTCHA validation failed: token is missing from request body.');
    return res.status(400).json({ message: 'reCAPTCHA token is required.' });
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token,
          remoteip: req.ip,
        },
      }
    );

    const { success, score, 'error-codes': errorCodes } = response.data;

    if (!success) {
      logger.warn('reCAPTCHA verification failed', { errorCodes });
      return res.status(400).json({ message: 'reCAPTCHA verification failed.' });
    }

    const threshold = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
    logger.info('reCAPTCHA validation score', { score, threshold });

    if (score < threshold) {
      logger.warn('reCAPTCHA blocked request: score below threshold', { score, threshold });
      return res.status(403).json({ message: 'reCAPTCHA score too low. Request blocked.' });
    }

    next();
  } catch (error) {
    logger.error('reCAPTCHA validation server error', { error: error.message });
    // Let the request pass if the validation service itself fails (fail-open)
    next();
  }
};

module.exports = validateRecaptcha;
