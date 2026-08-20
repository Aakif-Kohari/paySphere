const esopCalculator = require('../esopCalculator');
const { exerciseOptions } = require('../../controllers/esop.controller');
const { EsopGrant, EsopExercise } = require('../../models/esop.model');
const Employee = require('../../models/employee.model');

// Mock models
jest.mock('../../models/esop.model', () => {
  const mockFindOne = jest.fn();
  const mockCreate = jest.fn();
  return {
    EsopGrant: {
      findOne: mockFindOne,
    },
    EsopExercise: {
      create: mockCreate,
    },
    GRANT_STATUS: {
      ACTIVE: 'Active',
      FULLY_EXERCISED: 'FullyExercised',
    },
  };
});

jest.mock('../../models/employee.model', () => {
  const mockFindOne = jest.fn();
  return {
    findOne: mockFindOne,
  };
});

// Mock utilities
jest.mock('../../utils/vestingCalculator', () => ({
  buildVestingSchedule: jest.fn().mockReturnValue({
    valid: true,
    tranches: [
      { index: 1, vestDate: new Date('2026-08-20'), options: 100 },
    ],
    totalOptions: 100,
  }),
  vestedAsOf: jest.fn().mockReturnValue({
    valid: true,
    exercisable: 100,
    vested: 100,
    exercised: 0,
  }),
  computePerquisite: jest.fn().mockReturnValue({
    optionsExercised: 50,
    fmvPerShare: 200,
    exercisePrice: 100,
    spreadPerShare: 100,
    underwater: false,
    perquisiteValue: 5000,
    taxRatePercent: 30,
    tdsWithheld: 1500,
    exerciseCost: 5000,
    capitalGainsCostBasis: 10000,
  }),
  GRANT_STATUS: {
    ACTIVE: 'Active',
    FULLY_EXERCISED: 'FullyExercised',
  },
}));

// Mock logger & eventBus
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../event.service', () => ({
  emit: jest.fn(),
}));

describe('ESOP Vesting & Options Exercise Tax Calculator (#1247)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculateVestingSchedule should return tranches', () => {
    const grant = { optionsGranted: 100 };
    const schedule = esopCalculator.calculateVestingSchedule(grant);
    expect(schedule.valid).toBe(true);
    expect(schedule.tranches).toHaveLength(1);
  });

  test('calculateOptionExerciseTax should compute perquisites & TDS', () => {
    const valuation = esopCalculator.calculateOptionExerciseTax({
      optionsExercised: 50,
      fmvPerShare: 200,
      exercisePrice: 100,
      taxRatePercent: 30,
    });

    expect(valuation.perquisiteValue).toBe(5000);
    expect(valuation.tdsWithheld).toBe(1500);
  });

  test('exerciseOptions controller should record payroll month & year', async () => {
    const mockGrant = {
      _id: 'grant123',
      employeeId: 'emp123',
      exercisePrice: 100,
      optionsGranted: 100,
      optionsExercised: 0,
      optionsForfeited: 0,
      save: jest.fn().mockResolvedValue(true),
    };

    EsopGrant.findOne.mockResolvedValueOnce(mockGrant);
    EsopExercise.create.mockImplementationOnce(data => data);

    const req = {
      tenantId: 'tenant123',
      userId: 'admin123',
      params: { id: 'grant123' },
      body: {
        optionsToExercise: 50,
        fmvPerShare: 200,
        exerciseDate: new Date('2026-08-20'),
        taxRatePercent: 30,
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await exerciseOptions(req, res, next);

    expect(EsopExercise.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payrollMonth: 8,
        payrollYear: 2026,
        tdsWithheld: 1500,
      })
    );
    expect(mockGrant.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
