const { processWebhookJob, customBackoffStrategy } = require('../webhook.worker');
const { retryDlqJob, webhookQueue } = require('../../services/webhook.service');
const WebhookDelivery = require('../../models/webhookDelivery.model');
const WebhookEndpoint = require('../../models/webhookEndpoint.model');
const axios = require('axios');

// Mock WebhookDelivery and WebhookEndpoint models
jest.mock('../../models/webhookDelivery.model', () => {
  const mockCreate = jest.fn().mockResolvedValue({});
  const mockFindOne = jest.fn();
  return {
    create: mockCreate,
    findOne: mockFindOne,
  };
});

jest.mock('../../models/webhookEndpoint.model', () => {
  const mockFindOne = jest.fn();
  return {
    findOne: mockFindOne,
  };
});

// Mock BullMQ Queue and redis connection
jest.mock('bullmq', () => {
  const mockAdd = jest.fn().mockResolvedValue({});
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: mockAdd,
    })),
    Worker: jest.fn(),
  };
});

jest.mock('../../config/redis', () => ({
  isRedisAvailable: jest.fn().mockReturnValue(true),
}));

// Mock axios
jest.mock('axios');

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Webhook Worker and DLQ System (#1092)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('customBackoffStrategy should match delay limits', () => {
    expect(customBackoffStrategy(0)).toBe(60000);   // 1m
    expect(customBackoffStrategy(1)).toBe(300000);  // 5m
    expect(customBackoffStrategy(2)).toBe(1800000); // 30m
    expect(customBackoffStrategy(4)).toBeNull();    // Stops after max delay
  });

  test('processWebhookJob should calculate retry on attempt < 5', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network Timeout'));

    const mockJob = {
      attemptsMade: 1, // 2nd attempt
      data: {
        endpointId: 'ep123',
        tenantId: 'tenant123',
        url: 'https://example.com/webhook',
        secret: 'supersecret',
        eventName: 'PAYROLL_PAID',
        payload: { id: 1 },
      },
    };

    await expect(processWebhookJob(mockJob)).rejects.toThrow('Network Timeout');

    expect(WebhookDelivery.create).toHaveBeenCalled();
    const savePayload = WebhookDelivery.create.mock.calls[0][0];
    expect(savePayload.isSuccess).toBe(false);
    expect(savePayload.isDlq).toBeUndefined(); // Only true when attempts exhausted
    expect(savePayload.nextRetryAt).toBeDefined();
  });

  test('processWebhookJob should mark as isDlq on attempt 5 failure', async () => {
    axios.post.mockRejectedValueOnce(new Error('500 Internal Server Error'));

    const mockJob = {
      attemptsMade: 4, // 5th attempt
      data: {
        endpointId: 'ep123',
        tenantId: 'tenant123',
        url: 'https://example.com/webhook',
        secret: 'supersecret',
        eventName: 'PAYROLL_PAID',
        payload: { id: 1 },
      },
    };

    await expect(processWebhookJob(mockJob)).rejects.toThrow('500 Internal Server Error');

    expect(WebhookDelivery.create).toHaveBeenCalled();
    const savePayload = WebhookDelivery.create.mock.calls[0][0];
    expect(savePayload.isSuccess).toBe(false);
    expect(savePayload.isDlq).toBe(true); // Moved to Dead Letter Queue
    expect(savePayload.nextRetryAt).toBeUndefined();
  });

  test('retryDlqJob should enqueue job and reset DLQ status', async () => {
    const mockDelivery = {
      _id: 'del123',
      endpointId: 'ep123',
      eventName: 'PAYROLL_PAID',
      payload: { id: 1 },
      isDlq: true,
      save: jest.fn().mockResolvedValue({}),
    };
    WebhookDelivery.findOne.mockResolvedValueOnce(mockDelivery);

    const mockEndpoint = {
      _id: 'ep123',
      url: 'https://example.com/webhook',
      secret: 'supersecret',
    };
    WebhookEndpoint.findOne.mockResolvedValueOnce(mockEndpoint);

    const result = await retryDlqJob('del123', 'tenant123');

    expect(result.isDlq).toBe(false);
    expect(mockDelivery.save).toHaveBeenCalled();
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'deliver',
      expect.objectContaining({
        endpointId: 'ep123',
        url: 'https://example.com/webhook',
      })
    );
  });
});
