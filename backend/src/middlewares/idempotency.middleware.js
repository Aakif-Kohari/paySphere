const redisClient = require('../config/redis');
const IdempotencyRecord = require('../models/idempotencyRecord.model');
const logger = require('../utils/logger');

/**
 * Idempotency Middleware based on IETF Idempotency-Key draft.
 * Prevents duplicate execution of non-idempotent operations (like POST/PUT/PATCH)
 * on network retries.
 */
const idempotencyMiddleware = async (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res
      .status(400)
      .json({ error: 'Idempotency-Key header is required' });
  }

  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  if (!tenantId) {
    // If the route doesn't have tenant scope, we still need a way to isolate keys.
    // For now, if no tenantId, we'll reject it or use a default 'global' if safe.
    // Assuming all idempotency protected routes are tenant-scoped.
    return res
      .status(400)
      .json({ error: 'Tenant context required for idempotency' });
  }

  const redisKey = `idempotency:${tenantId}:${idempotencyKey}`;
  const isRedisAvailable =
    redisClient.isRedisAvailable && redisClient.isRedisAvailable();

  let existingRecord = null;

  try {
    if (isRedisAvailable) {
      const data = await redisClient.get(redisKey);
      if (data) {
        existingRecord = JSON.parse(data);
      }
    } else {
      existingRecord = await IdempotencyRecord.findOne({
        tenantId,
        idempotencyKey,
      }).lean();
    }
  } catch (error) {
    logger.error('Error fetching idempotency record', {
      error: error.message,
      tenantId,
      idempotencyKey,
    });
    // Proceed if we can't fetch, although this risks duplication, returning 500 might be safer.
    // We will fail closed to prevent duplication.
    return res
      .status(500)
      .json({ error: 'Internal server error checking idempotency' });
  }

  if (existingRecord) {
    if (existingRecord.status === 'processing') {
      return res
        .status(409)
        .json({
          error: 'A request with this Idempotency-Key is already processing',
        });
    }

    if (existingRecord.status === 'completed') {
      // Return the cached response
      return res
        .status(existingRecord.responseStatus || 200)
        .json(existingRecord.responseBody);
    }
  }

  // Register the key as processing
  const processingRecord = {
    tenantId,
    idempotencyKey,
    status: 'processing',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  try {
    if (isRedisAvailable) {
      // Set NX (Only set the key if it does not already exist) to handle concurrent requests gracefully
      const acquired = await redisClient.set(
        redisKey,
        JSON.stringify(processingRecord),
        'PX',
        24 * 60 * 60 * 1000,
        'NX',
      );
      if (!acquired) {
        // Another request slipped in
        return res
          .status(409)
          .json({
            error: 'A request with this Idempotency-Key is already processing',
          });
      }
    } else {
      await IdempotencyRecord.create(processingRecord);
    }
  } catch (error) {
    if (error.code === 11000) {
      // MongoDB duplicate key error
      return res
        .status(409)
        .json({
          error: 'A request with this Idempotency-Key is already processing',
        });
    }
    logger.error('Error saving processing idempotency record', {
      error: error.message,
      tenantId,
      idempotencyKey,
    });
    return res
      .status(500)
      .json({ error: 'Internal server error saving idempotency status' });
  }

  // Hook into response to save the result
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const saveCompletion = async (body, status) => {
    let parsedBody = body;
    if (typeof body === 'string') {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        // Leave as string if not JSON
      }
    }

    const completedRecord = {
      tenantId,
      idempotencyKey,
      status: 'completed',
      responseBody: parsedBody,
      responseStatus: status || res.statusCode || 200,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    try {
      if (isRedisAvailable) {
        await redisClient.set(
          redisKey,
          JSON.stringify(completedRecord),
          'PX',
          24 * 60 * 60 * 1000,
        );
      } else {
        await IdempotencyRecord.updateOne(
          { tenantId, idempotencyKey },
          { $set: completedRecord },
          { upsert: true },
        );
      }
    } catch (error) {
      logger.error('Error saving completed idempotency record', {
        error: error.message,
        tenantId,
        idempotencyKey,
      });
    }
  };

  res.json = function (body) {
    saveCompletion(body, res.statusCode);
    return originalJson(body);
  };

  res.send = function (body) {
    if (typeof body === 'string') {
      // Only intercept object/json bodies usually, but strings might be error messages
      saveCompletion(body, res.statusCode);
    }
    return originalSend(body);
  };

  next();
};

module.exports = idempotencyMiddleware;
