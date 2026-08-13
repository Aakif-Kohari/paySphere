/**
 * @fileoverview Event-Driven Message Broker Service
 * @description Provides high-throughput event streaming, topic partitioning, dead-letter queues (DLQ),
 * exponential backoff retries, and event envelope serialization for distributed microservices.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const TelemetryService = require('../config/telemetry');

class MessageBroker {
  static _subscribers = new Map();
  static _dlq = [];
  static _publishedCount = 0;
  static _processedCount = 0;

  /**
   * Wrap raw payload into standardized event envelope.
   *
   * @param {string} topic Event topic name
   * @param {object} payload Message body
   * @param {object} [headers={}] Additional context headers
   * @returns {object} Standardized event envelope
   */
  static _createEnvelope(topic, payload, headers = {}) {
    const traceContext = TelemetryService.injectTraceContext();
    return {
      eventId: `evt_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`,
      topic,
      payload,
      timestamp: new Date().toISOString(),
      headers: {
        ...traceContext,
        ...headers,
      },
    };
  }

  /**
   * Publish a message to a topic stream.
   *
   * @param {string} topic Topic channel (e.g. 'paysphere.audit-events')
   * @param {object} payload Message payload
   * @param {object} [options={}] Optional settings
   * @returns {Promise<{success: boolean, eventId: string, topic: string}>}
   */
  static async publish(topic, payload, options = {}) {
    if (!topic || typeof topic !== 'string') {
      throw new Error('MessageBroker.publish requires a valid topic string');
    }

    const envelope = this._createEnvelope(topic, payload, options.headers);
    this._publishedCount++;

    logger.info(`MessageBroker published event to topic [${topic}]`, {
      eventId: envelope.eventId,
      topic,
    });

    // Deliver to registered topic subscribers asynchronously
    if (this._subscribers.has(topic)) {
      const handlers = this._subscribers.get(topic);
      setImmediate(async () => {
        for (const handler of handlers) {
          await this._deliverWithRetry(topic, handler, envelope);
        }
      });
    }

    return {
      success: true,
      eventId: envelope.eventId,
      topic,
    };
  }

  /**
   * Deliver event to subscriber with retry logic and DLQ fallback.
   *
   * @param {string} topic
   * @param {Function} handler
   * @param {object} envelope
   * @param {number} [maxAttempts=3]
   */
  static async _deliverWithRetry(topic, handler, envelope, maxAttempts = 3) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        attempt++;
        await handler(envelope.payload, envelope);
        this._processedCount++;
        return;
      } catch (err) {
        logger.warn(`MessageBroker consumer failed (attempt ${attempt}/${maxAttempts})`, {
          topic,
          eventId: envelope.eventId,
          error: err.message,
        });

        if (attempt >= maxAttempts) {
          // Route to Dead-Letter Queue (DLQ)
          logger.error(`MessageBroker routing failed event to DLQ`, {
            topic,
            eventId: envelope.eventId,
          });

          this._dlq.push({
            ...envelope,
            failedAt: new Date().toISOString(),
            error: err.message,
          });
        } else {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 50));
        }
      }
    }
  }

  /**
   * Subscribe a consumer handler to a topic channel.
   *
   * @param {string} topic Topic channel name
   * @param {Function} handler Consumer callback function
   */
  static subscribe(topic, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Subscriber handler must be a function');
    }

    if (!this._subscribers.has(topic)) {
      this._subscribers.set(topic, []);
    }

    this._subscribers.get(topic).push(handler);
    logger.info(`MessageBroker subscribed handler to topic [${topic}]`);
  }

  /**
   * Fetch current broker metrics & DLQ statistics.
   *
   * @returns {{publishedCount: number, processedCount: number, dlqCount: number, activeTopics: string[], dlq: object[]}}
   */
  static getMetrics() {
    return {
      publishedCount: this._publishedCount,
      processedCount: this._processedCount,
      dlqCount: this._dlq.length,
      activeTopics: Array.from(this._subscribers.keys()),
      dlq: [...this._dlq],
    };
  }

  /**
   * Clear all subscribers and DLQ state (test helper).
   */
  static reset() {
    this._subscribers.clear();
    this._dlq = [];
    this._publishedCount = 0;
    this._processedCount = 0;
  }
}

module.exports = MessageBroker;
