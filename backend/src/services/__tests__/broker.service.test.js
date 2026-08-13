'use strict';

const MessageBroker = require('../broker.service');

describe('MessageBroker', () => {
  beforeEach(() => {
    MessageBroker.reset();
  });

  describe('publish & subscribe', () => {
    it('should format event envelope and deliver payload to subscribed handlers', (done) => {
      const topic = 'paysphere.test-events';
      const payload = { action: 'PAYROLL_APPROVE', id: 123 };

      MessageBroker.subscribe(topic, (receivedPayload, envelope) => {
        try {
          expect(receivedPayload).toEqual(payload);
          expect(envelope.topic).toBe(topic);
          expect(envelope.eventId).toMatch(/^evt_/);
          expect(envelope.headers.traceparent).toBeDefined();
          done();
        } catch (err) {
          done(err);
        }
      });

      MessageBroker.publish(topic, payload);
    });

    it('should throw error when publishing to empty topic', async () => {
      await expect(MessageBroker.publish('', {})).rejects.toThrow();
    });
  });

  describe('retries & Dead-Letter Queue (DLQ)', () => {
    it('should route failing consumer tasks to DLQ after retries', (done) => {
      const topic = 'paysphere.failing-topic';
      const failingHandler = jest.fn(() => {
        throw new Error('Consumer execution failed');
      });

      MessageBroker.subscribe(topic, failingHandler);
      MessageBroker.publish(topic, { test: 'fail' });

      setTimeout(() => {
        try {
          const metrics = MessageBroker.getMetrics();
          expect(metrics.dlqCount).toBe(1);
          expect(metrics.dlq[0].topic).toBe(topic);
          expect(metrics.dlq[0].error).toBe('Consumer execution failed');
          done();
        } catch (err) {
          done(err);
        }
      }, 500);
    });
  });
});
