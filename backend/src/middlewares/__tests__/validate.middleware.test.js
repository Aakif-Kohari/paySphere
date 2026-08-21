const { validateRequest } = require('../validate.middleware');
const { signupSchema, employeeSchema } = require('../../validations/schemas');

const runValidation = (schema, body) => {
  const req = { body };
  const next = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  validateRequest(schema)(req, res, next);
  return { req, next, res };
};

describe('validateRequest (#38)', () => {
  it('accepts a valid signup payload including optional reCAPTCHA', () => {
    const { next, res } = runValidation(signupSchema, {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'SecurePass1!',
      companyName: 'PaySphere',
      recaptchaToken: 'token',
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects wrong signup field types before the controller', () => {
    const { next, res } = runValidation(signupSchema, {
      fullName: 123,
      email: 'not-an-email',
      password: 'short',
      companyName: { name: 'PaySphere' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Validation failed',
      errors: expect.any(Array),
    }));
  });

  it('rejects unknown signup fields instead of silently stripping them', () => {
    const { next, res } = runValidation(signupSchema, {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'SecurePass1!',
      companyName: 'PaySphere',
      unexpected: 'attack',
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid employee types and unknown fields', () => {
    const { next, res } = runValidation(employeeSchema, {
      fullName: 'Jane Doe',
      role: 'Engineer',
      monthlySalary: '50000',
      department: 'Engineering',
      unexpected: true,
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts a valid employee creation payload', () => {
    const { next, res } = runValidation(employeeSchema, {
      fullName: 'Jane Doe',
      role: 'Engineer',
      department: 'Engineering',
      monthlySalary: 50000,
      overtimeRate: 250,
      dateOfBirth: '1995-05-10',
      joiningDate: '2026-01-15',
      email: 'jane@example.com',
      phone: '+919876543210',
      currency: 'INR',
      bankDetails: {
        bankName: 'Example Bank',
        accountNumber: '1234567890',
        routingCode: 'IFSC1234',
      },
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
