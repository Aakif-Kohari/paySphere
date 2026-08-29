/**
 * Financial-year aggregation for Form 16 / 24Q (#933, repaired in #951).
 *
 * The first test is the load: this module required
 * `../models/employeeTaxDeclaration.model`, which was never committed, so it
 * threw on require and no statutory report could ever be produced.
 *
 * The rest is about numbers that end up on a government form. A certificate
 * that understates tax deducted is not a cosmetic defect.
 */

const leanMock = (rows) => ({ lean: jest.fn().mockResolvedValue(rows) });

jest.mock('../../models/payroll.model', () => ({ find: jest.fn() }));
jest.mock('../../models/employee.model', () => ({ find: jest.fn() }));
jest.mock('../../models/employeeTaxDeclaration.model', () => ({
  find: jest.fn(),
}));

const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const EmployeeTaxDeclaration = require('../../models/employeeTaxDeclaration.model');
const {
  aggregateFYData,
  getFYDates,
  STANDARD_DEDUCTION,
  _internals,
} = require('../complianceAggregator');

const TENANT = '507f1f77bcf86cd799439099';
const EMP_A = '607f1f77bcf86cd7994390a1';
const EMP_B = '607f1f77bcf86cd7994390a2';

const employee = (id, fullName) => ({
  _id: id,
  fullName,
  department: 'Engineering',
  joiningDate: new Date(2024, 5, 1),
});

/** A paid payroll row with named deduction lines. */
const payroll = ({
  employeeId,
  month,
  year,
  baseSalary = 50000,
  bonus = 0,
  customDeductions = [],
}) => ({
  employeeId,
  month,
  year,
  baseSalary,
  bonus,
  overtimePay: 0,
  deductions: customDeductions.reduce((s, d) => s + d.amount, 0),
  customDeductions,
});

beforeEach(() => {
  jest.clearAllMocks();
  PayrollUpdate.find.mockReturnValue(leanMock([]));
  Employee.find.mockReturnValue(leanMock([]));
  EmployeeTaxDeclaration.find.mockReturnValue(leanMock([]));
});

describe('the module loads (#951)', () => {
  it('resolves every model it requires', () => {
    expect(() => require('../complianceAggregator')).not.toThrow();
    expect(typeof aggregateFYData).toBe('function');
  });
});

describe('the financial year window', () => {
  it('runs April to March', () => {
    const { start, end } = getFYDates(2026);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3); // April
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(2); // March
  });

  it('queries both halves of the year', async () => {
    await aggregateFYData(TENANT, 2026);

    const filter = PayrollUpdate.find.mock.calls[0][0];

    expect(filter.tenantId).toBe(TENANT);
    expect(filter.status).toEqual({ $in: ['approved', 'paid'] });
    expect(filter.$or).toEqual([
      { year: 2026, month: { $gte: 4 } },
      { year: 2027, month: { $lte: 3 } },
    ]);
  });

  it('refuses to aggregate without a tenant', async () => {
    // The result of this function is a file somebody downloads. An unscoped
    // read would put another company's salaries in it.
    await expect(aggregateFYData(null, 2026)).resolves.toEqual([]);
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });
});

describe('tax withheld', () => {
  it('is summed from the deduction lines that are tax', async () => {
    // The regression: `totalTDS` was initialised to 0 and never assigned, so
    // every Form 16 certified that no tax had been deducted.
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([
        payroll({
          employeeId: EMP_A,
          month: 4,
          year: 2026,
          customDeductions: [
            { name: 'TDS', amount: 4000 },
            { name: 'Professional Tax', amount: 200 },
            { name: 'Canteen', amount: 500 },
          ],
        }),
        payroll({
          employeeId: EMP_A,
          month: 5,
          year: 2026,
          customDeductions: [
            { name: 'Income Tax', amount: 4500 },
            { name: 'PT', amount: 200 },
          ],
        }),
      ]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.totalTDS).toBe(8500);
    // And professional tax is only the professional tax lines — it used to be
    // the whole `deductions` column, canteen included.
    expect(row.professionalTax).toBe(400);
  });

  it('matches deduction names case- and spacing-insensitively', () => {
    const { sumDeductionsMatching, TDS_LABELS } = _internals;

    const row = {
      customDeductions: [
        { name: '  tds  ', amount: 100 },
        { name: 'Tax Deducted at Source', amount: 200 },
        { name: 'Loan repayment', amount: 900 },
      ],
    };

    expect(sumDeductionsMatching(row, TDS_LABELS)).toBe(300);
  });

  it('is zero, not NaN, for a row with no deduction lines', async () => {
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([payroll({ employeeId: EMP_A, month: 4, year: 2026 })]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.totalTDS).toBe(0);
    expect(row.professionalTax).toBe(0);
  });
});

describe('who appears in the aggregate', () => {
  it('leaves out employees with no payroll in the year', async () => {
    // #933 emitted a row of zeroes for every employee on the books, so a 24Q
    // export named people the company had never paid in that year — and a
    // return that does that has to be corrected afterwards.
    Employee.find.mockReturnValue(
      leanMock([employee(EMP_A, 'Alice Smith'), employee(EMP_B, 'Bob Jones')]),
    );
    PayrollUpdate.find.mockReturnValue(
      leanMock([payroll({ employeeId: EMP_A, month: 4, year: 2026 })]),
    );

    const rows = await aggregateFYData(TENANT, 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0].employeeName).toBe('Alice Smith');
    expect(rows[0].monthsPaid).toBe(1);
  });

  it('sorts by name so an export is stable between runs', async () => {
    Employee.find.mockReturnValue(
      leanMock([employee(EMP_B, 'Bob Jones'), employee(EMP_A, 'Alice Smith')]),
    );
    PayrollUpdate.find.mockReturnValue(
      leanMock([
        payroll({ employeeId: EMP_B, month: 4, year: 2026 }),
        payroll({ employeeId: EMP_A, month: 4, year: 2026 }),
      ]),
    );

    const names = (await aggregateFYData(TENANT, 2026)).map(
      (r) => r.employeeName,
    );

    expect(names).toEqual(['Alice Smith', 'Bob Jones']);
  });
});

describe('the declaration', () => {
  it('supplies the PAN and the regime', async () => {
    // `Employee` has no `pan` path, so #933's `emp.pan` was undefined for
    // everybody and every certificate carried 'N/A' where a PAN is mandatory.
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([payroll({ employeeId: EMP_A, month: 4, year: 2026 })]),
    );
    EmployeeTaxDeclaration.find.mockReturnValue(
      leanMock([{ employeeId: EMP_A, pan: 'ABCDE1234F', regime: 'old' }]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.pan).toBe('ABCDE1234F');
    expect(row.regime).toBe('old');
  });

  it('defaults to the new regime and an empty PAN when none was filed', async () => {
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([payroll({ employeeId: EMP_A, month: 4, year: 2026 })]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.regime).toBe('new');
    expect(row.pan).toBe('');
  });

  it('is fetched for the year being reported on, scoped by tenant', async () => {
    await aggregateFYData(TENANT, 2026);

    expect(EmployeeTaxDeclaration.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      financialYear: 2026,
    });
  });
});

describe('taxable income', () => {
  it('is gross less professional tax and the standard deduction', async () => {
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([
        payroll({
          employeeId: EMP_A,
          month: 4,
          year: 2026,
          baseSalary: 100000,
          bonus: 20000,
          customDeductions: [{ name: 'Professional Tax', amount: 200 }],
        }),
      ]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.grossSalary).toBe(120000);
    expect(row.netTaxableIncome).toBe(120000 - 200 - STANDARD_DEDUCTION);
  });

  it('never goes below zero', async () => {
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([
        payroll({ employeeId: EMP_A, month: 4, year: 2026, baseSalary: 10000 }),
      ]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.netTaxableIncome).toBe(0);
  });

  it('counts an arrears payout as salary of the year it was paid in', async () => {
    Employee.find.mockReturnValue(leanMock([employee(EMP_A, 'Alice Smith')]));
    PayrollUpdate.find.mockReturnValue(
      leanMock([
        {
          ...payroll({ employeeId: EMP_A, month: 4, year: 2026 }),
          arrearsPayout: 12000,
        },
      ]),
    );

    const [row] = await aggregateFYData(TENANT, 2026);

    expect(row.grossSalary).toBe(62000);
  });
});
