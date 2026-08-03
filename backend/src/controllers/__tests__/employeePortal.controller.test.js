const mongoose = require("mongoose");
const {
  getEmployeeProfile,
  getMyPayslips,
} = require("../employeePortal.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const OWNER_A = new mongoose.Types.ObjectId();
const OWNER_B = new mongoose.Types.ObjectId();
const EMPLOYEE_A = new mongoose.Types.ObjectId();
const EMPLOYEE_B = new mongoose.Types.ObjectId();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

/** `User.findById(...).select(...)` */
const mockUser = (user) => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(user),
  });
};

/** `Employee.findById(...).select(...)` / `Employee.findOne(...).select(...)` */
const selectResolving = (value) => ({
  select: jest.fn().mockResolvedValue(value),
});

/** The chained builder `getMyPayslips` uses. */
const payslipChain = (rows) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(rows),
});

const employeeDoc = (id, createdBy, overrides = {}) => ({
  _id: id,
  createdBy,
  fullName: "Sam Carter",
  email: "sam@example.com",
  monthlySalary: 90000,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  PayrollUpdate.countDocuments.mockResolvedValue(0);
  PayrollUpdate.find.mockReturnValue(payslipChain([]));
});

describe("employee portal — tenant scoping (#561)", () => {
  test("an unlinked login never matches another company's employee by email", async () => {
    // The old code ran `Employee.findOne({ email: user.email })` with no
    // ownership scope, so the same address in two directories resolved to
    // whichever document Mongo reached first.
    mockUser({
      _id: OWNER_B,
      email: "sam@example.com",
      companyName: "Company B",
      employeeId: null,
    });
    Employee.findOne.mockReturnValue(selectResolving(null));

    const res = makeRes();
    await getEmployeeProfile({ userId: String(OWNER_B) }, res, jest.fn());

    expect(Employee.findOne).toHaveBeenCalledWith({
      email: "sam@example.com",
      createdBy: OWNER_B,
    });
    expect(res.json.mock.calls[0][0].employee).toBeNull();
  });

  test("an owner still sees their own record in their own directory", async () => {
    mockUser({
      _id: OWNER_A,
      email: "sam@example.com",
      companyName: "Company A",
      employeeId: null,
    });
    Employee.findOne.mockReturnValue(
      selectResolving(employeeDoc(EMPLOYEE_A, OWNER_A)),
    );

    const res = makeRes();
    await getEmployeeProfile({ userId: String(OWNER_A) }, res, jest.fn());

    expect(res.json.mock.calls[0][0].employee._id).toEqual(EMPLOYEE_A);
  });

  test("a linked login resolves through employeeId, not the address", async () => {
    mockUser({
      _id: OWNER_B,
      email: "sam@example.com",
      companyName: "Company B",
      employeeId: EMPLOYEE_B,
    });
    Employee.findById.mockReturnValue(
      selectResolving(employeeDoc(EMPLOYEE_B, OWNER_B)),
    );

    const res = makeRes();
    await getEmployeeProfile({ userId: String(OWNER_B) }, res, jest.fn());

    expect(Employee.findById).toHaveBeenCalledWith(EMPLOYEE_B);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });

  test("does not select the whole user document to return four fields", async () => {
    // `select("-password")` pulled resetPasswordToken, googleId, tokenVersion
    // and the base64 company logo along with it.
    const select = jest.fn().mockResolvedValue(null);
    User.findById.mockReturnValue({ select });

    const res = makeRes();
    await getEmployeeProfile({ userId: String(OWNER_A) }, res, jest.fn());

    expect(select).toHaveBeenCalledWith(
      "fullName email role companyName employeeId",
    );
    expect(select).not.toHaveBeenCalledWith("-password");
  });

  test("does not expose bank details or salary history in the projection", async () => {
    mockUser({ _id: OWNER_A, email: "sam@example.com", employeeId: EMPLOYEE_A });
    const select = jest.fn().mockResolvedValue(employeeDoc(EMPLOYEE_A, OWNER_A));
    Employee.findById.mockReturnValue({ select });

    await getEmployeeProfile({ userId: String(OWNER_A) }, makeRes(), jest.fn());

    const projection = select.mock.calls[0][0];
    expect(projection).not.toContain("bankDetails");
    expect(projection).toContain("fullName");
  });

  test("returns 404 when the account is gone", async () => {
    mockUser(null);

    const res = makeRes();
    await getEmployeeProfile({ userId: String(OWNER_A) }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("a dangling employee link yields no profile rather than throwing", async () => {
    mockUser({ _id: OWNER_A, email: "sam@example.com", employeeId: EMPLOYEE_A });
    Employee.findById.mockReturnValue(selectResolving(null));

    const res = makeRes();
    await getEmployeeProfile({ userId: String(OWNER_A) }, res, jest.fn());

    expect(res.json.mock.calls[0][0].employee).toBeNull();
  });
});

describe("getMyPayslips — scoping and filtering (#561)", () => {
  const linkedRequest = (query = {}) => ({
    userId: String(OWNER_B),
    query,
  });

  beforeEach(() => {
    mockUser({ _id: OWNER_B, email: "sam@example.com", employeeId: EMPLOYEE_B });
    Employee.findById.mockReturnValue(
      selectResolving(employeeDoc(EMPLOYEE_B, OWNER_B)),
    );
  });

  test("scopes the payroll query by the tenant that owns the employee", async () => {
    await getMyPayslips(linkedRequest(), makeRes(), jest.fn());

    const query = PayrollUpdate.find.mock.calls[0][0];
    expect(query.employeeId).toEqual(EMPLOYEE_B);
    expect(query.createdBy).toBe(String(OWNER_B));
  });

  test("shows only payable rows — never a pending or rejected figure", async () => {
    await getMyPayslips(linkedRequest(), makeRes(), jest.fn());

    const query = PayrollUpdate.find.mock.calls[0][0];
    expect(query.status.$in).toEqual(
      expect.arrayContaining(["approved", "paid"]),
    );
    expect(query.status.$in).not.toContain("pending_approval");
    expect(query.status.$in).not.toContain("rejected");
  });

  test("paginates instead of returning every row ever written", async () => {
    const chain = payslipChain([]);
    PayrollUpdate.find.mockReturnValue(chain);

    await getMyPayslips(linkedRequest({ page: "3", limit: "10" }), makeRes(), jest.fn());

    expect(chain.skip).toHaveBeenCalledWith(20);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  test("clamps an absurd page size", async () => {
    const chain = payslipChain([]);
    PayrollUpdate.find.mockReturnValue(chain);

    await getMyPayslips(linkedRequest({ limit: "100000" }), makeRes(), jest.fn());

    expect(chain.limit).toHaveBeenCalledWith(12);
  });

  test("ignores a negative page", async () => {
    const chain = payslipChain([]);
    PayrollUpdate.find.mockReturnValue(chain);

    await getMyPayslips(linkedRequest({ page: "-4" }), makeRes(), jest.fn());

    expect(chain.skip).toHaveBeenCalledWith(0);
  });

  test("projects payslip fields only", async () => {
    const chain = payslipChain([]);
    PayrollUpdate.find.mockReturnValue(chain);

    await getMyPayslips(linkedRequest(), makeRes(), jest.fn());

    const projection = chain.select.mock.calls[0][0];
    expect(projection).toContain("netSalary");
    expect(projection).not.toContain("salarySnapshot");
    expect(projection).not.toContain("loanRecoveries ");
  });

  test("an unlinked login gets an empty history, not somebody else's", async () => {
    mockUser({ _id: OWNER_B, email: "sam@example.com", employeeId: null });
    Employee.findOne.mockReturnValue(selectResolving(null));

    const res = makeRes();
    await getMyPayslips(linkedRequest(), res, jest.fn());

    expect(PayrollUpdate.find).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].payrolls).toEqual([]);
  });

  test("reports the total so the client can page", async () => {
    PayrollUpdate.countDocuments.mockResolvedValue(37);

    const res = makeRes();
    await getMyPayslips(linkedRequest(), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.totalCount).toBe(37);
    expect(body.totalPages).toBe(4);
  });

  test("passes a query failure to the error handler", async () => {
    PayrollUpdate.find.mockImplementation(() => {
      throw new Error("DB exploded");
    });

    const next = jest.fn();
    await getMyPayslips(linkedRequest(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
