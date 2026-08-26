const { maskPII, maskObject } = require('../dataMask.middleware');

describe('Data Masking Middleware (PII Protection)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { accountType: 'employee' },
      accountType: 'employee',
    };
    res = {
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('maskObject helper', () => {
    it('should format Social Security Numbers as ***-**-XXXX', () => {
      const payload = { ssn: '123-45-6789', name: 'John Doe' };
      maskObject(payload);

      expect(payload.ssn).toBe('***-**-6789');
      expect(payload.name).toBe('John Doe');
    });

    it('should mask Bank Accounts and Tax IDs keeping last 4 characters', () => {
      const payload = {
        bankAccount: '9876543210',
        panNumber: 'ABCDE1234F',
        iban: 'GB82WEST12345698765432',
      };

      maskObject(payload);

      expect(payload.bankAccount).toBe('******3210');
      expect(payload.panNumber).toBe('******234F');
      expect(payload.iban).toBe('******************5432');
    });

    it('should recursively mask nested objects and array payloads', () => {
      const payload = {
        employees: [
          { name: 'Alice', ssn: '999887777', bankDetails: { accountNumber: '555444333' } },
          { name: 'Bob', ssn: '111223333', bankDetails: { accountNumber: '222333444' } },
        ],
      };

      maskObject(payload);

      expect(payload.employees[0].ssn).toBe('***-**-7777');
      expect(payload.employees[0].bankDetails.accountNumber).toBe('*****4333');
      expect(payload.employees[1].ssn).toBe('***-**-3333');
      expect(payload.employees[1].bankDetails.accountNumber).toBe('*****3444');
    });
  });

  describe('maskPII middleware', () => {
    it('should intercept res.json and mask PII fields for non-privileged accounts', () => {
      req.accountType = 'EMPLOYEE';
      maskPII(req, res, next);

      expect(next).toHaveBeenCalled();

      // Trigger the intercepted json response
      const payload = { id: '1', ssn: '123456789', bankAccount: '111222333' };
      res.json(payload);

      expect(res.json).not.toBe(payload);
    });

    it('should pass unmasked data through for privileged Admin accounts', () => {
      req.accountType = 'ADMIN';
      maskPII(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).toBeInstanceOf(Function);
    });

    it('should pass unmasked data through for Owner accounts', () => {
      req.accountType = 'OWNER';
      maskPII(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
