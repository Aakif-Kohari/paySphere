/**
 * Statutory compliance endpoints (#933, reachable since #951).
 *
 * Two properties matter most here, and neither was checked before because
 * neither handler could be loaded:
 *
 *   - a tenant that has not entered its TAN gets a 400 telling it so, not a
 *     TypeError. `generateForm24Q` dereferenced a config it never checked for.
 *   - a Form 24Q export covers the quarter it says it covers, and contains only
 *     the caller's own employees.
 */

const mongoose = require('mongoose');

jest.mock('../../models/complianceConfig.model', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/employeeTaxDeclaration.model', () => {
  const model = { find: jest.fn(), findOneAndUpdate: jest.fn() };
  model.DECLARATION_STATUS = {
    DECLARED: 'declared',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
  };
  return model;
});
jest.mock('../../models/employee.model', () => ({ findOne: jest.fn() }));
jest.mock('../../utils/complianceAggregator', () => ({
  aggregateFYData: jest.fn(),
}));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));

const ComplianceConfig = require('../../models/complianceConfig.model');
const EmployeeTaxDeclaration = require('../../models/employeeTaxDeclaration.model');
const Employee = require('../../models/employee.model');
const { aggregateFYData } = require('../../utils/complianceAggregator');
const {
  generateForm16,
  generateForm24Q,
  getComplianceConfig,
  upsertComplianceConfig,
  getTaxDeclarations,
  upsertTaxDeclaration,
  _internals,
} = require('../compliance.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const EMP_A = '607f1f77bcf86cd7994390a1';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  setHeader: jest.fn(),
});

const config = {
  _id: new mongoose.Types.ObjectId(),
  tenantId: TENANT,
  companyName: 'Acme Pvt Ltd',
  tan: 'DELA12345B',
  pan: 'AAACA1234A',
};

/** One aggregated employee, paid in the months given. */
const aggregated = ({
  employeeId = EMP_A,
  employeeName = 'Alice Smith',
  months = [4],
  year = 2026,
  totalTDS = 8000,
} = {}) => ({
  employeeId,
  employeeName,
  pan: 'ABCDE1234F',
  regime: 'new',
  department: 'Engineering',
  monthsPaid: months.length,
  grossSalary: 600000,
  perquisites: 0,
  professionalTax: 2400,
  standardDeduction: 50000,
  totalTDS,
  netTaxableIncome: 547600,
  payrolls: months.map((month) => ({
    month,
    year,
    baseSalary: 50000,
    bonus: 0,
    overtimePay: 0,
  })),
});

let req;
let res;
let next;

beforeEach(() => {
  jest.clearAllMocks();

  req = { userId: USER, tenantId: TENANT, params: {}, query: {}, body: {} };
  res = makeRes();
  next = jest.fn();

  ComplianceConfig.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(config),
  });
  aggregateFYData.mockResolvedValue([aggregated()]);
});

describe('the financial year parameter', () => {
  const { parseFinancialYear } = _internals;

  it('rejects anything that is not a plausible year', () => {
    ['abc', '19', '1999', '2101', '2026.5'].forEach((raw) => {
      expect(parseFinancialYear(raw).ok).toBe(false);
    });
  });

  it('accepts a year and defaults to the last complete one', () => {
    expect(parseFinancialYear('2026')).toEqual({ ok: true, fyStartYear: 2026 });
    expect(parseFinancialYear(undefined).ok).toBe(true);
  });
});

describe('GET /form-24q', () => {
  it('answers 400 when the company has no TAN on file', async () => {
    // The regression. #933 read the config and went straight to `config.tan`
    // in the row map — a TypeError for every tenant on day one.
    ComplianceConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await generateForm24Q(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/TAN\/PAN/);
  });

  it('rejects an unknown quarter', async () => {
    req.query = { quarter: 'Q5', fy: 2026 };

    await generateForm24Q(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/Q1, Q2, Q3 or Q4/);
  });

  it('includes only employees paid inside the quarter', async () => {
    // Alice was paid in April (Q1); Bob in January (Q4). A Q1 export naming Bob
    // is a return that has to be corrected.
    aggregateFYData.mockResolvedValue([
      aggregated({ employeeName: 'Alice Smith', months: [4, 5] }),
      aggregated({
        employeeId: '607f1f77bcf86cd7994390a2',
        employeeName: 'Bob Jones',
        months: [1],
        year: 2027,
      }),
    ]);
    req.query = { quarter: 'Q1', fy: 2026 };

    await generateForm24Q(req, res, next);

    const csv = res.send.mock.calls[0][0];

    expect(csv).toContain('Alice Smith');
    expect(csv).not.toContain('Bob Jones');
  });

  it('sums only the quarter’s gross, not the year’s', async () => {
    aggregateFYData.mockResolvedValue([aggregated({ months: [4, 5, 6, 7] })]);
    req.query = { quarter: 'Q1', fy: 2026 };

    await generateForm24Q(req, res, next);

    const [, row] = res.send.mock.calls[0][0].split('\n');

    // Three of the four months fall in Q1, at 50000 each.
    expect(row).toContain('150000');
  });

  it('escapes a name that would otherwise break the row', async () => {
    aggregateFYData.mockResolvedValue([
      aggregated({ employeeName: 'O\'Brien, "Danny"' }),
    ]);
    req.query = { quarter: 'Q1', fy: 2026 };

    await generateForm24Q(req, res, next);

    const lines = res.send.mock.calls[0][0].split('\n');

    // Header plus exactly one data row — the quotes inside the name did not
    // split it, and the commas did not shift every column after it.
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('""Danny""');
  });

  it('sends a CSV with the quarter in the filename', async () => {
    req.query = { quarter: 'Q3', fy: 2026 };
    aggregateFYData.mockResolvedValue([aggregated({ months: [10] })]);

    await generateForm24Q(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(res.setHeader.mock.calls[1][1]).toContain('Form24Q_Q3_FY2026-27');
  });
});

describe('GET /form-16/:employeeId', () => {
  it('rejects a malformed employee id before touching the database', async () => {
    req.params = { employeeId: 'not-an-id' };

    await generateForm16(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ComplianceConfig.findOne).not.toHaveBeenCalled();
  });

  it('answers 400 when the company has no TAN on file', async () => {
    ComplianceConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    req.params = { employeeId: EMP_A };

    await generateForm16(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('answers 404 when the employee was not paid in that year', async () => {
    aggregateFYData.mockResolvedValue([]);
    req.params = { employeeId: EMP_A };
    req.query = { fy: 2026 };

    await generateForm16(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toMatch(/FY 2026-27/);
  });
});

describe('the employer details', () => {
  it('returns null rather than 404 when none are set', async () => {
    ComplianceConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await getComplianceConfig(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ config: null });
  });

  it('upserts against the caller’s tenant and uppercases the identifiers', async () => {
    ComplianceConfig.findOneAndUpdate.mockResolvedValue(config);
    req.body = {
      companyName: 'Acme Pvt Ltd',
      tan: ' dela12345b ',
      pan: 'aaaca1234a',
    };

    await upsertComplianceConfig(req, res, next);

    const [filter, update] = ComplianceConfig.findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({ tenantId: TENANT });
    expect(update.$set.tan).toBe('DELA12345B');
    expect(update.$set.pan).toBe('AAACA1234A');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('turns a schema validation failure into a 400 naming the field', async () => {
    ComplianceConfig.findOneAndUpdate.mockRejectedValue({
      name: 'ValidationError',
      errors: { tan: { message: 'TAN must be in the format AAAA00000A' } },
    });
    req.body = { companyName: 'Acme', tan: 'NOPE', pan: 'AAACA1234A' };

    await upsertComplianceConfig(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual([
      'TAN must be in the format AAAA00000A',
    ]);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tax declarations', () => {
  it('lists only the caller tenant’s rows for the year asked for', async () => {
    EmployeeTaxDeclaration.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    req.query = { fy: 2026 };

    await getTaxDeclarations(req, res, next);

    expect(EmployeeTaxDeclaration.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      financialYear: 2026,
    });
  });

  it('refuses an employee that belongs to another company', async () => {
    // The lookup is scoped by tenant, so a valid id from another company is a
    // 404 here rather than a declaration row opened against their employee.
    Employee.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    req.params = { employeeId: EMP_A };
    req.body = { financialYear: 2026, regime: 'old' };

    await upsertTaxDeclaration(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMP_A,
      tenantId: TENANT,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(EmployeeTaxDeclaration.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('copies across only the sections the schema knows about', async () => {
    Employee.findOne.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue({ _id: EMP_A, fullName: 'Alice Smith' }),
    });
    EmployeeTaxDeclaration.findOneAndUpdate.mockResolvedValue({
      _id: 'decl1',
      regime: 'old',
    });

    req.params = { employeeId: EMP_A };
    req.body = {
      financialYear: 2026,
      regime: 'OLD',
      pan: 'abcde1234f',
      declarations: {
        section80C: '150000',
        section80D: -500,
        somethingInvented: 999999,
      },
    };

    await upsertTaxDeclaration(req, res, next);

    const [, update] = EmployeeTaxDeclaration.findOneAndUpdate.mock.calls[0];

    expect(update.$set.regime).toBe('old');
    expect(update.$set.pan).toBe('ABCDE1234F');
    expect(update.$set.declarations.section80C).toBe(150000);
    // Negative clamps to zero, and an invented key is not carried through.
    expect(update.$set.declarations.section80D).toBe(0);
    expect(update.$set.declarations.somethingInvented).toBeUndefined();
  });

  it('stamps the verifier when a declaration is marked verified', async () => {
    Employee.findOne.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue({ _id: EMP_A, fullName: 'Alice Smith' }),
    });
    EmployeeTaxDeclaration.findOneAndUpdate.mockResolvedValue({ _id: 'decl1' });

    req.params = { employeeId: EMP_A };
    req.body = { financialYear: 2026, status: 'verified' };

    await upsertTaxDeclaration(req, res, next);

    const [, update] = EmployeeTaxDeclaration.findOneAndUpdate.mock.calls[0];

    expect(update.$set.verifiedBy).toBe(USER);
    expect(update.$set.verifiedAt).toBeInstanceOf(Date);
  });

  it('reports a concurrent write as a conflict, not a 500', async () => {
    Employee.findOne.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue({ _id: EMP_A, fullName: 'Alice Smith' }),
    });
    EmployeeTaxDeclaration.findOneAndUpdate.mockRejectedValue({ code: 11000 });

    req.params = { employeeId: EMP_A };
    req.body = { financialYear: 2026 };

    await upsertTaxDeclaration(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });
});
