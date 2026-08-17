const { getTurnoverMetrics } = require('../turnover.service');
const Employee = require('../../models/employee.model');
const mongoose = require('mongoose');

jest.mock('../../models/employee.model');

describe('turnover.service - getTurnoverMetrics', () => {
  it('exports getTurnoverMetrics service function', () => {
    expect(typeof getTurnoverMetrics).toBe('function');
  });

  it('aggregates departure reason structure correctly', async () => {
    Employee.aggregate.mockResolvedValue([
      { _id: 'resignation', count: 3 },
      { _id: 'termination', count: 1 },
      { _id: 'retirement', count: 1 }
    ]);

    const mockUserId = new mongoose.Types.ObjectId();
    const result = await getTurnoverMetrics(mockUserId);

    expect(result).toHaveProperty('departuresByReason');
    expect(result.departuresByReason.resignation).toBe(3);
    expect(result.departuresByReason.termination).toBe(1);
    expect(result.departuresByReason.retirement).toBe(1);
    expect(result.departuresByReason.voluntary).toBe(4);
    expect(result.departuresByReason.involuntary).toBe(1);
  });
});
