const request = require('supertest');
const express = require('express');
const reportsRoutes = require('../reports.routes');
const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const User = require('../../models/user.model');

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRoutes);

// Mock Auth and RBAC middleware for integration tests
jest.mock('../../middlewares/auth.middleware', () => (req, res, next) => {
  req.userId = '507f1f77bcf86cd799439011';
  req.tenantId = '507f1f77bcf86cd799439012';
  next();
});

jest.mock('../../middlewares/rbac.middleware', () => ({
  requirePermission: () => (req, res, next) => next(),
}));

// Mock Mongoose models
jest.mock('../../models/payroll.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/user.model');
jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../services/cache.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue(true),
  invalidatePattern: jest.fn().mockResolvedValue(true),
  invalidateAnalytics: jest.fn().mockResolvedValue(true),
}));

// Mock Worker Threads for PDF generation
jest.mock('worker_threads', () => {
  const EventEmitter = require('events');
  class MockWorker extends EventEmitter {
    postMessage() {}
    on(event, cb) {
      super.on(event, cb);
      if (event === 'message') {
        cb({
          success: true,
          pdfData: Buffer.from(
            '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
          ),
        });
      }
    }
    terminate() {}
  }
  return { Worker: MockWorker };
});

// Mock PDFKit for payslip buffer generation inside zip endpoint
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const listeners = {};
    const doc = {
      pipe: jest.fn(),
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      strokeColor: jest.fn().mockReturnThis(),
      lineWidth: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      switchToPage: jest.fn().mockReturnThis(),
      bufferedPageRange: jest.fn().mockReturnValue({ count: 1 }),
      page: { height: 842 },
      on: jest.fn((event, callback) => {
        listeners[event] = callback;
        return doc;
      }),
      end: jest.fn(() => {
        if (listeners['data'])
          listeners['data'](Buffer.from('%PDF-1.4 payslip content'));
        if (listeners['end']) listeners['end']();
        return doc;
      }),
    };
    return doc;
  });
});

// Mock Archiver for zip stream generation
jest.mock('archiver', () => {
  return jest.fn().mockImplementation(() => {
    const EventEmitter = require('events');
    const emitter = new EventEmitter();
    emitter.pipe = jest.fn().mockImplementation((dest) => {
      emitter.on('data', (chunk) => {
        if (dest.write) dest.write(chunk);
      });
      emitter.on('end', () => {
        if (dest.end) dest.end();
      });
      return dest;
    });
    emitter.append = jest.fn();
    emitter.finalize = jest.fn().mockImplementation(() => {
      setImmediate(() => {
        emitter.emit('data', Buffer.from('PK\x03\x04mock zip content'));
        emitter.emit('end');
      });
      return Promise.resolve();
    });
    return emitter;
  });
});

const parseBinary = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

describe('PDF Generation Integration Tests (Supertest)', () => {
  const mockPayrolls = [
    {
      _id: '607f1f77bcf86cd799439001',
      tenantId: '507f1f77bcf86cd799439012',
      employeeId: '607f1f77bcf86cd799439002',
      employeeName: 'John Doe',
      month: 8,
      year: 2026,
      baseSalary: 50000,
      overtimePay: 2000,
      bonus: 3000,
      deductions: 1000,
      leaveDeduction: 500,
      netSalary: 53500,
      status: 'PAID',
    },
  ];

  const mockEmployees = [
    {
      _id: '607f1f77bcf86cd799439002',
      name: 'John Doe',
      companyName: 'Acme Corp',
      designation: 'Software Engineer',
      department: 'Engineering',
    },
  ];

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    settings: {
      companyInfo: { companyLogo: 'https://example.com/logo.png' },
      payrollConfig: { currency: 'INR' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    PayrollUpdate.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockPayrolls),
    });
    Employee.find.mockResolvedValue(mockEmployees);
    User.findById.mockResolvedValue(mockUser);
  });

  describe('GET /api/reports/download-pdf', () => {
    it('should return 200 OK with application/pdf headers and valid binary PDF stream', async () => {
      const response = await request(app)
        .get('/api/reports/download-pdf?month=8&year=2026')
        .buffer(true)
        .parse(parseBinary)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename=payroll-report-August-2026\.pdf/,
      );
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.toString('utf-8')).toContain('%PDF-1.4');
    });

    it('should return 400 Bad Request when month parameter is invalid', async () => {
      const response = await request(app)
        .get('/api/reports/download-pdf?month=15&year=2026')
        .expect(400);

      expect(response.body).toEqual({ message: 'Invalid month parameter' });
    });

    it('should return 400 Bad Request when year parameter is out of range', async () => {
      const response = await request(app)
        .get('/api/reports/download-pdf?month=8&year=1999')
        .expect(400);

      expect(response.body).toEqual({ message: 'Invalid year parameter' });
    });

    it('should return 404 Not Found when no payroll data exists for period', async () => {
      PayrollUpdate.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app)
        .get('/api/reports/download-pdf?month=8&year=2026')
        .expect(404);

      expect(response.body).toEqual({
        message: 'No payroll data found for the selected period.',
      });
    });
  });

  describe('GET /api/reports/download-zip', () => {
    it('should return 200 OK with zip headers and binary zip stream of payslip PDFs', async () => {
      const response = await request(app)
        .get('/api/reports/download-zip?month=8&year=2026')
        .buffer(true)
        .parse(parseBinary)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename=payslips-August-2026\.zip/,
      );
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 404 Not Found for zip export when no payrolls match', async () => {
      PayrollUpdate.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app)
        .get('/api/reports/download-zip?month=8&year=2026')
        .expect(404);

      expect(response.body).toEqual({
        message: 'No payroll data found for the selected period.',
      });
    });
  });
});
