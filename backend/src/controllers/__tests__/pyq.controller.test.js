jest.mock('../../models/pyq.model', () => {
  const model = {
    create: jest.fn(),
    find: jest.fn(),
    insertMany: jest.fn(),
  };
  return model;
});

jest.mock('../../models/pyqTrend.model', () => {
  const model = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  return model;
});

jest.mock('../../utils/gemini', () => ({
  generatePYQTrend: jest.fn().mockResolvedValue({
    predictedDifficulty: 'hard',
    difficultyConfidence: 90,
    topics: [
      {
        chapter: 'Calculus',
        probability: 0.9,
        trend: 'rising',
        weightageClass: 'high',
        badge: 'Rising Weightage in 2026',
      },
    ],
  }),
  getLocalFallbackTrend: jest.fn().mockReturnValue({
    predictedDifficulty: 'medium',
    difficultyConfidence: 75,
    topics: [],
  }),
}));

const mongoose = require('mongoose');
const PYQ = require('../../models/pyq.model');
const PYQTrend = require('../../models/pyqTrend.model');
const { generatePYQTrend } = require('../../utils/gemini');
const {
  createPYQ,
  bulkUploadPYQs,
  getPYQs,
  generateTrendForecast,
  getLatestTrendForecast,
} = require('../pyq.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (body = {}, query = {}, params = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  body,
  query,
  params,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PYQ Controller Tests', () => {
  describe('createPYQ', () => {
    test('creates a PYQ entry', async () => {
      const res = buildRes();
      const body = {
        subject: 'Maths',
        exam: 'JEE',
        year: 2024,
        question: 'Integrate x dx',
        chapter: 'Calculus',
        difficulty: 'medium',
        tags: ['integration'],
      };
      PYQ.create.mockResolvedValue(body);

      await createPYQ(buildReq(body), res, jest.fn());

      expect(PYQ.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Maths',
          year: 2024,
          tenantId: TENANT_ID,
          createdBy: USER_ID,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('bulkUploadPYQs', () => {
    test('inserts multiple PYQ records', async () => {
      const res = buildRes();
      const pyqs = [
        {
          subject: 'Physics',
          exam: 'NEET',
          year: 2023,
          question: 'F = ma',
          chapter: 'Mechanics',
          difficulty: 'easy',
        },
      ];
      PYQ.insertMany.mockResolvedValue(pyqs);

      await bulkUploadPYQs(buildReq({ pyqs }), res, jest.fn());

      expect(PYQ.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            chapter: 'Mechanics',
            tenantId: TENANT_ID,
          }),
        ])
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('generateTrendForecast', () => {
    test('triggers Gemini AI analysis and saves trend prediction', async () => {
      const res = buildRes();
      const pyqs = [{ chapter: 'Calculus', difficulty: 'hard', year: 2023 }];
      const chain = { lean: jest.fn().mockResolvedValue(pyqs) };
      PYQ.find.mockReturnValue(chain);

      const forecastData = {
        predictedDifficulty: 'hard',
        difficultyConfidence: 90,
        topics: [
          {
            chapter: 'Calculus',
            probability: 0.9,
            trend: 'rising',
            weightageClass: 'high',
            badge: 'Rising Weightage in 2026',
          },
        ],
      };
      PYQTrend.findOneAndUpdate.mockResolvedValue(forecastData);

      await generateTrendForecast(
        buildReq({ subject: 'Maths', exam: 'JEE', forecastYear: 2026 }),
        res,
        jest.fn()
      );

      expect(generatePYQTrend).toHaveBeenCalledWith(pyqs, 'Maths', 'JEE', 2026);
      expect(PYQTrend.findOneAndUpdate).toHaveBeenCalledWith(
        {
          tenantId: TENANT_ID,
          subject: 'Maths',
          exam: 'JEE',
          forecastYear: 2026,
        },
        expect.objectContaining({
          predictedDifficulty: 'hard',
          difficultyConfidence: 90,
        }),
        { new: true, upsert: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
