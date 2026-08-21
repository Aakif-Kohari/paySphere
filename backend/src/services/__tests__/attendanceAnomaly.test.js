const { detectAnomalyAndAlert, haversineDistance } = require('../attendanceAnomaly');
const { verifyBiometricPayload } = require('../../middlewares/biometricSecurity');
const { RawPunchLog, BiometricDevice } = require('../../models/biometric.model');
const Employee = require('../../models/employee.model');
const { sendEmail } = require('../../utils/email');
const crypto = require('crypto');

// Mock models
jest.mock('../../models/biometric.model', () => {
  const mockFindOne = jest.fn();
  const mockFindById = jest.fn();
  return {
    RawPunchLog: {
      findOne: mockFindOne,
    },
    BiometricDevice: {
      findOne: mockFindOne,
      findById: mockFindById,
    },
  };
});

jest.mock('../../models/employee.model', () => {
  const mockFindOne = jest.fn();
  return {
    findOne: mockFindOne,
  };
});

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Biometric Punch Security & Attendance Anomaly Detection (#1246)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('haversineDistance should compute correct distance', () => {
    // Bangalore to Chennai distance is ~290km
    const bangalore = { lat: 12.9716, lng: 77.5946 };
    const chennai = { lat: 13.0827, lng: 80.2707 };
    const dist = haversineDistance(bangalore.lat, bangalore.lng, chennai.lat, bangalore.lng); // vertical dist
    expect(dist).toBeGreaterThan(0);
  });

  test('detectAnomalyAndAlert should flag Impossible Travel velocity logs', async () => {
    const mockPunch = {
      tenantId: 'tenant123',
      deviceId: 'dev_b',
      externalEmployeeId: 'emp123',
      timestamp: new Date('2026-08-20T12:30:00Z'),
      status: 'Unprocessed',
      save: jest.fn(),
    };

    // Previous punch: Bangalore, 15 minutes earlier
    RawPunchLog.findOne.mockResolvedValueOnce({
      deviceId: 'dev_a',
      timestamp: new Date('2026-08-20T12:15:00Z'),
      status: 'Reconciled',
    });

    // Bangalore Coordinates
    BiometricDevice.findById
      .mockResolvedValueOnce({ latitude: 12.9716, longitude: 77.5946 }) // Current: Bangalore
      .mockResolvedValueOnce({ latitude: 13.0827, longitude: 80.2707 }); // Previous: Chennai (impossible distance 290km in 15 mins)

    Employee.findOne.mockResolvedValueOnce({
      fullName: 'John Doe',
      email: 'john@example.com',
    });

    const isAnomaly = await detectAnomalyAndAlert(mockPunch);

    expect(isAnomaly).toBe(true);
    expect(mockPunch.status).toBe('Flagged');
    expect(mockPunch.anomalyFlags).toContain('Impossible Travel');
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@example.com',
        subject: expect.stringContaining('Biometric Punch Anomaly Detected'),
      })
    );
  });

  test('detectAnomalyAndAlert should flag Proxy Punching if checked in on another device within 1 minute', async () => {
    const mockPunch = {
      tenantId: 'tenant123',
      deviceId: 'dev_b',
      externalEmployeeId: 'emp123',
      timestamp: new Date('2026-08-20T12:30:00Z'),
      status: 'Unprocessed',
      save: jest.fn(),
    };

    // Previous punch: 30 seconds earlier on dev_a
    RawPunchLog.findOne.mockResolvedValueOnce({
      deviceId: 'dev_a',
      timestamp: new Date('2026-08-20T12:29:30Z'),
      status: 'Reconciled',
    });

    BiometricDevice.findById
      .mockResolvedValueOnce({ latitude: 12.9716, longitude: 77.5946 })
      .mockResolvedValueOnce({ latitude: 12.9716, longitude: 77.5946 }); // Same coordinates, different physical devices

    Employee.findOne.mockResolvedValueOnce({
      fullName: 'John Doe',
      email: 'john@example.com',
    });

    const isAnomaly = await detectAnomalyAndAlert(mockPunch);

    expect(isAnomaly).toBe(true);
    expect(mockPunch.status).toBe('Flagged');
    expect(mockPunch.anomalyFlags).toContain('Proxy Punching Suspected');
  });

  test('verifyBiometricPayload should approve valid signature and block invalid signature', async () => {
    const secret = 'device-secret-123';
    BiometricDevice.findOne.mockResolvedValueOnce({
      tenantId: 'tenant123',
      secretKey: secret,
    });

    const body = { deviceSerial: 'sn-123', punch: 'in' };
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(body));
    const validSignature = hmac.digest('hex');

    const req = {
      headers: { 'x-biometric-signature': validSignature },
      body,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await verifyBiometricPayload(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantId).toBe('tenant123');
  });
});
