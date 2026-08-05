const { addEmployee, updateEmployee } = require('../employee.controller');
const Employee = require('../../models/employee.model');
const User = require('../../models/user.model');

// The company. A different value from the user id on purpose: since #613 the
// scope is the tenant, not the account that created the row.
const TENANT = '507f1f77bcf86cd799439099';

jest.mock('../../models/payroll.model', () => ({
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  exists: jest.fn().mockResolvedValue(false),
  deleteMany: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../models/user.model');
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  emitAuditLog: jest.fn(),
  on: jest.fn(),
}));
jest.mock('../../services/cache.service', () => ({
  invalidatePattern: jest.fn().mockResolvedValue(undefined),
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

let constructed;
jest.mock('../../models/employee.model', () => {
  const mockConstructor = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);

    this._id = 'emp-1';
    this.save = jest.fn().mockResolvedValue(this);
    return this;
  });
  mockConstructor.findById = jest.fn();
  return mockConstructor;
});

describe('addEmployee — email persistence (#414)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: 'user123',
      tenantId: TENANT,
      body: {
        fullName: 'Asha R',
        role: 'Designer',
        monthlySalary: 40000,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    User.findById.mockResolvedValue({ companyName: 'Acme Ltd' });
    Employee.mockImplementation(function (data) {
      Object.assign(this, data);
      this._id = 'emp-1';
      this.save = jest.fn().mockResolvedValue(this);
      constructed = this;
      return this;
    });
  });

  test('persists a supplied email instead of discarding it', async () => {
    // `email` was destructured out of req.body and never referenced again, so
    // the API accepted an address, returned 201, and stored nothing. Payslip
    // email delivery could therefore never find an address to send to.
    req.body.email = 'asha@acme.com';

    await addEmployee(req, res, next);

    expect(constructed.email).toBe('asha@acme.com');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('normalizes the address to lowercase and trims it', async () => {
    req.body.email = '  Asha@ACME.com  ';

    await addEmployee(req, res, next);

    expect(constructed.email).toBe('asha@acme.com');
  });

  test('rejects a malformed address with 400 instead of accepting and dropping it', async () => {
    req.body.email = 'not-an-email';

    await addEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid email address format',
    });
    expect(Employee).not.toHaveBeenCalled();
  });

  test('rejects a non-string address (NoSQL injection vector)', async () => {
    req.body.email = { $gt: '' };

    await addEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('accepts international phone numbers with a country code', async () => {
    req.body.phone = '+1 (415) 555-1234';

    await addEmployee(req, res, next);

    expect(constructed.phone).toBe('+1 (415) 555-1234');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rejects malformed phone numbers with 400', async () => {
    req.body.phone = '91-12345';

    await addEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Phone number must be a valid international phone number',
    });
  });

  test('omits the field entirely when no email is given', async () => {
    // Storing "" would put every email-less employee into the same bucket of
    // the unique index and re-create the collision.
    await addEmployee(req, res, next);

    expect(constructed.email).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('treats a blank string as no email rather than rejecting it', async () => {
    req.body.email = '   ';

    await addEmployee(req, res, next);

    expect(constructed.email).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 409 on a duplicate-email index violation', async () => {
    req.body.email = 'asha@acme.com';
    const duplicateError = Object.assign(new Error('E11000'), {
      code: 11000,
      keyPattern: { email: 1, tenantId: 1 },
    });
    Employee.mockImplementation(function (data) {
      Object.assign(this, data);
      this.save = jest.fn().mockRejectedValue(duplicateError);
      return this;
    });

    await addEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'An employee with this email address already exists',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards a duplicate violation on a different index to next()', async () => {
    const nameClash = Object.assign(new Error('E11000'), {
      code: 11000,
      keyPattern: { tenantId: 1, fullName: 1, role: 1 },
    });
    Employee.mockImplementation(function (data) {
      Object.assign(this, data);
      this.save = jest.fn().mockRejectedValue(nameClash);
      return this;
    });

    await addEmployee(req, res, next);

    expect(next).toHaveBeenCalledWith(nameClash);
    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  test('still stores bank details alongside the email', async () => {
    req.body.email = 'asha@acme.com';
    req.body.bankDetails = {
      bankName: 'HDFC',
      accountNumber: '12345',
      routingCode: 'HDFC0001',
    };

    await addEmployee(req, res, next);

    expect(constructed.email).toBe('asha@acme.com');
    expect(constructed.bankDetails.bankName).toBe('HDFC');
  });
});

describe('updateEmployee — email persistence (#414)', () => {
  let req;
  let res;
  let next;
  let employee;

  beforeEach(() => {
    jest.clearAllMocks();
    employee = {
      _id: 'emp-1',
      fullName: 'Asha R',
      role: 'Designer',
      monthlySalary: 40000,
      email: 'asha@acme.com',
      createdBy: { toString: () => 'user123' },
    tenantId: { toString: () => TENANT },
      bankDetails: {},
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn(),
    };

    req = { userId: 'user123', tenantId: TENANT, params: { id: 'emp-1' }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    Employee.findById.mockResolvedValue(employee);
  });

  test('applies a new email instead of discarding it', async () => {
    req.body.email = 'asha.r@acme.com';

    await updateEmployee(req, res, next);

    expect(employee.email).toBe('asha.r@acme.com');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('normalizes the updated address', async () => {
    req.body.email = '  ASHA.R@Acme.COM ';

    await updateEmployee(req, res, next);

    expect(employee.email).toBe('asha.r@acme.com');
  });

  test('rejects a malformed address with 400', async () => {
    req.body.email = 'broken@';

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employee.save).not.toHaveBeenCalled();
  });

  test('clears the address when an empty string is sent', async () => {
    req.body.email = '';

    await updateEmployee(req, res, next);

    expect(employee.email).toBeUndefined();
    expect(employee.markModified).toHaveBeenCalledWith('email');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('clears the address when null is sent', async () => {
    req.body.email = null;

    await updateEmployee(req, res, next);

    expect(employee.email).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('accepts an international phone number on update', async () => {
    req.body.phone = '+44 20 7946 0958';

    await updateEmployee(req, res, next);

    expect(employee.phone).toBe('+44 20 7946 0958');
    expect(employee.markModified).toHaveBeenCalledWith('phone');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rejects a malformed phone number with 400', async () => {
    req.body.phone = '12345';

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Phone number must be a valid international phone number',
    });
  });

  test('leaves the existing address untouched when email is omitted', async () => {
    req.body = { role: 'Senior Designer' };

    await updateEmployee(req, res, next);

    expect(employee.email).toBe('asha@acme.com');
    expect(employee.markModified).not.toHaveBeenCalledWith('email');
  });

  test('returns 409 on a duplicate-email violation', async () => {
    req.body.email = 'taken@acme.com';
    employee.save.mockRejectedValue(
      Object.assign(new Error('E11000'), {
        code: 11000,
        keyPattern: { email: 1, tenantId: 1 },
      }),
    );

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('still enforces ownership before touching the email', async () => {
    employee.tenantId = { toString: () => 'someone-elses-company' };
    req.body.email = 'attacker@evil.com';

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(employee.save).not.toHaveBeenCalled();
  });
});
