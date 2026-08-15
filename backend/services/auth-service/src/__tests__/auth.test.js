const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');

// Mock User Model
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  const mockSave = jest.fn().mockResolvedValue({});
  const mockFindOne = jest.fn();

  const mockModel = jest.fn().mockImplementation(() => ({
    save: mockSave,
  }));
  mockModel.findOne = mockFindOne;

  return {
    ...actualMongoose,
    model: jest.fn().mockReturnValue(mockModel),
    models: {},
  };
});

describe('Auth Service Microservice (#1040)', () => {
  let UserMock;

  beforeEach(() => {
    jest.clearAllMocks();
    UserMock = mongoose.model('User');
  });

  test('POST /api/auth/signup - creates a user successfully', async () => {
    UserMock.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        fullName: 'John Doe',
        email: 'john@example.com',
        companyName: 'ACME Corp',
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('registered successfully');
  });

  test('POST /api/auth/login - returns JWT token with correct inputs', async () => {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    
    UserMock.findOne.mockResolvedValue({
      _id: 'u123',
      fullName: 'John Doe',
      email: 'john@example.com',
      companyName: 'ACME Corp',
      password: hashedPassword,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'john@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });
});
