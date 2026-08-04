const mongoose = require("mongoose");
const {
  getPendingApprovals,
  approvePayroll,
  rejectPayroll,
  markPayrollPaid,
  sendPayslipEmailHandler,
  sendAllPayslipsEmailHandler,
} = require("../payroll.controller");
const PayrollUpdate = require("../../models/payroll.model");
const Employee = require("../../models/employee.model");
const eventBus = require("../../services/event.service");

jest.mock("../../models/payroll.model");
jest.mock("../../models/employee.model");
jest.mock("../../models/user.model");
jest.mock("../../services/cache.service", () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../services/email.service", () => ({
  sendPayslipEmail: jest.fn().mockResolvedValue(undefined),
}));

const cacheService = require("../../services/cache.service");
const { sendPayslipEmail } = require("../../services/email.service");

const OWNER = "507f1f77bcf86cd799439011";
const OTHER_OWNER = "507f1f77bcf86cd799439099";

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const ID_A = "607f1f77bcf86cd7994390a1";
const ID_B = "607f1f77bcf86cd7994390a2";
const ID_C = "607f1f77bcf86cd7994390a3";

/** A find() result that supports the chained builders the controller uses. */
const selectMock = (data) => ({
  select: jest.fn().mockResolvedValue(data),
});

const listMock = (data) => {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
    catch: (reject) => Promise.resolve(data).catch(reject),
  };
  return chain;
};

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const payrollRow = (id, status, overrides = {}) => ({
  _id: oid(id),
  status,
  employeeName: `Employee ${id.slice(-1)}`,
  month: 7,
  year: 2026,
  netSalary: 50000,
  ...overrides,
});

describe("getPendingApprovals — tenant scoping (#458)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: OWNER, query: {} };
    res = makeRes();
    next = jest.fn();

    PayrollUpdate.find.mockImplementation(() => listMock([]));
    PayrollUpdate.countDocuments.mockResolvedValue(0);
    PayrollUpdate.aggregate.mockResolvedValue([]);
  });

  test("scopes the queue to the caller — the handler previously read every company's payroll", async () => {
    await getPendingApprovals(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(PayrollUpdate.find).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: OWNER,
        status: "pending_approval",
      }),
    );
  });

  test("counts with the same scoped filter as the listing", async () => {
    await getPendingApprovals(req, res, next);

    const findFilter = PayrollUpdate.find.mock.calls[0][0];
    const countFilter = PayrollUpdate.countDocuments.mock.calls[0][0];
    expect(countFilter).toEqual(findFilter);
  });

  test("returns the pending total so the checker sees the size of what they are signing", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([
      { _id: null, totalNetSalary: 123456.789, employeeCount: 3 },
    ]);

    await getPendingApprovals(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.pendingTotalNetSalary).toBe(123456.79);
    expect(payload.pendingEmployeeCount).toBe(3);
  });

  test("reports zero totals rather than crashing when the queue is empty", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([]);

    await getPendingApprovals(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.pendingTotalNetSalary).toBe(0);
    expect(payload.pendingEmployeeCount).toBe(0);
  });

  test("clamps the page size and rejects a nonsense page number", async () => {
    req.query = { page: "-4", limit: "9999" };

    await getPendingApprovals(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.currentPage).toBe(1);
  });

  test("rejects an out-of-range month filter", async () => {
    req.query = { month: "13" };

    await getPendingApprovals(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });

  test("rejects an out-of-range year filter", async () => {
    req.query = { year: "1899" };

    await getPendingApprovals(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("approvePayroll — ownership and transitions (#458)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: OWNER, body: {} };
    res = makeRes();
    next = jest.fn();
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  test("rejects a missing or empty payrollIds array", async () => {
    for (const body of [{}, { payrollIds: [] }, { payrollIds: "abc" }]) {
      jest.clearAllMocks();
      req.body = body;
      await approvePayroll(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(PayrollUpdate.find).not.toHaveBeenCalled();
    }
  });

  test("rejects non-ObjectId ids instead of letting a CastError surface as a 500", async () => {
    req.body = { payrollIds: ["not-an-object-id"] };

    await approvePayroll(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain("Invalid payroll id");
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });

  test("rejects an unbounded batch", async () => {
    req.body = { payrollIds: new Array(201).fill(ID_A) };

    await approvePayroll(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain("more than 200");
  });

  test("always scopes the ownership read by createdBy", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    expect(PayrollUpdate.find).toHaveBeenCalledWith({
      _id: { $in: [ID_A] },
      createdBy: OWNER,
    });
  });

  test("another company's payroll id is reported as notFound and never written", async () => {
    // The scoped read returns nothing: the row exists, but not for this caller.
    PayrollUpdate.find.mockImplementation(() => selectMock([]));
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.approvedCount).toBe(0);
    expect(payload.notFound).toEqual([ID_A]);
  });

  test("a mixed batch approves only the rows the caller owns", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A, ID_B] };

    await approvePayroll(req, res, next);

    const writeFilter = PayrollUpdate.updateMany.mock.calls[0][0];
    expect(writeFilter.createdBy).toBe(OWNER);
    expect(writeFilter._id.$in.map(String)).toEqual([ID_A]);

    const payload = res.json.mock.calls[0][0];
    expect(payload.approvedCount).toBe(1);
    expect(payload.notFound).toEqual([ID_B]);
  });

  test("persists approvedBy and approvedAt — strict mode silently dropped both before", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    const update = PayrollUpdate.updateMany.mock.calls[0][1].$set;
    expect(update.status).toBe("approved");
    expect(update.approvedBy).toBe(OWNER);
    expect(update.approvedAt).toBeInstanceOf(Date);
  });

  test("clears a prior rejection so a resubmitted row is not both approved and rejected", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    const update = PayrollUpdate.updateMany.mock.calls[0][1].$set;
    expect(update.rejectionReason).toBeUndefined();
    expect(update.rejectedBy).toBeUndefined();
  });

  test("refuses to approve a paid row and explains why", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "paid")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.invalidTransition).toHaveLength(1);
    expect(payload.invalidTransition[0].currentStatus).toBe("paid");
    expect(payload.invalidTransition[0].reason).toMatch(/final/i);
  });

  test("refuses to approve a rejected row without a fresh submission", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "rejected")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test("re-approving an already approved row is idempotent, not an error", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "approved")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("de-duplicates repeated ids so the tally cannot be inflated", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A, ID_A, ID_A] };

    await approvePayroll(req, res, next);

    expect(PayrollUpdate.find.mock.calls[0][0]._id.$in).toEqual([ID_A]);
    expect(res.json.mock.calls[0][0].approvedCount).toBe(1);
  });

  test("invalidates the analytics cache, since approved rows enter every total", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    expect(cacheService.invalidateAnalytics).toHaveBeenCalledWith(OWNER);
  });

  test("emits a PAYROLL_APPROVE audit event — #438 recorded nothing at all", async () => {
    const emitSpy = jest.spyOn(eventBus, "emit");
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([event, payload]) =>
        event === "AUDIT_LOG" && payload.action === "PAYROLL_APPROVE",
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[1].userId).toBe(OWNER);
    expect(auditCall[1].resourceIds).toEqual([ID_A]);
    emitSpy.mockRestore();
  });

  test("marks the audit result partial when part of the batch did not apply", async () => {
    const emitSpy = jest.spyOn(eventBus, "emit");
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A, ID_B] };

    await approvePayroll(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([, payload]) => payload && payload.action === "PAYROLL_APPROVE",
    );
    expect(auditCall[1].result).toBe("partial");
    emitSpy.mockRestore();
  });

  test("returns 409 Conflict when a concurrent update causes a version mismatch", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval", { __v: 0 })]),
    );
    req.body = { payrollIds: [ID_A] };
    PayrollUpdate.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    await approvePayroll(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain("concurrent update");
  });
});

describe("rejectPayroll — reason handling (#458)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: OWNER, body: {} };
    res = makeRes();
    next = jest.fn();
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 1 });
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
  });

  test("requires a non-blank reason", async () => {
    for (const reason of [undefined, "", "   ", 42, null]) {
      jest.clearAllMocks();
      req.body = { payrollIds: [ID_A], reason };
      await rejectPayroll(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    }
  });

  test("persists the reason — it was not on the schema, so it was discarded", async () => {
    req.body = { payrollIds: [ID_A], reason: "  Overtime hours look wrong  " };

    await rejectPayroll(req, res, next);

    const update = PayrollUpdate.updateMany.mock.calls[0][1].$set;
    expect(update.status).toBe("rejected");
    expect(update.rejectionReason).toBe("Overtime hours look wrong");
    expect(update.rejectedBy).toBe(OWNER);
    expect(update.rejectedAt).toBeInstanceOf(Date);
  });

  test("truncates an oversized reason to the schema limit rather than 500ing on validation", async () => {
    req.body = { payrollIds: [ID_A], reason: "x".repeat(900) };

    await rejectPayroll(req, res, next);

    const update = PayrollUpdate.updateMany.mock.calls[0][1].$set;
    expect(update.rejectionReason).toHaveLength(500);
  });

  test("clears a prior approval when a row is sent back", async () => {
    req.body = { payrollIds: [ID_A], reason: "Wrong month" };

    await rejectPayroll(req, res, next);

    // The controller passes `approvedBy: undefined` to mean "clear this".
    // Mongoose strips undefined values out of a $set, so that never actually
    // cleared anything — a row rejected after an approval kept the old
    // approver. Explicitly cleared fields belong in $unset (#559).
    const [, update] = PayrollUpdate.updateMany.mock.calls[0];
    expect(update.$set.approvedBy).toBeUndefined();
    expect(update.$set.approvedAt).toBeUndefined();
    expect(update.$unset).toEqual({ approvedBy: "", approvedAt: "" });
  });

  test("scopes the read by createdBy so another company's run cannot be rejected", async () => {
    req.body = { payrollIds: [ID_A], reason: "Not mine" };

    await rejectPayroll(req, res, next);

    expect(PayrollUpdate.find).toHaveBeenCalledWith({
      _id: { $in: [ID_A] },
      createdBy: OWNER,
    });
  });

  test("cannot reject a paid row", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "paid")]),
    );
    req.body = { payrollIds: [ID_A], reason: "Too late" };

    await rejectPayroll(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("markPayrollPaid — reaching the terminal state (#458)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: OWNER, body: {} };
    res = makeRes();
    next = jest.fn();
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  test("moves an approved row to paid and stamps paidAt", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "approved")]),
    );
    req.body = { payrollIds: [ID_A] };

    await markPayrollPaid(req, res, next);

    const update = PayrollUpdate.updateMany.mock.calls[0][1].$set;
    expect(update.status).toBe("paid");
    expect(update.paidAt).toBeInstanceOf(Date);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("refuses to pay a row that has not been approved", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    req.body = { payrollIds: [ID_A] };

    await markPayrollPaid(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test("legacy finalized rows normalise to approved and can therefore be paid", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "finalized")]),
    );
    req.body = { payrollIds: [ID_A] };

    await markPayrollPaid(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("scopes the read by createdBy", async () => {
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "approved")]),
    );
    req.body = { payrollIds: [ID_A, ID_C] };

    await markPayrollPaid(req, res, next);

    expect(PayrollUpdate.find.mock.calls[0][0].createdBy).toBe(OWNER);
  });
});

describe("payslip dispatch is gated on approval (#458)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = makeRes();
    next = jest.fn();
  });

  test("refuses to email a payslip for a pending row", async () => {
    req = { userId: OWNER, params: { id: ID_A } };
    PayrollUpdate.findOne.mockResolvedValue({
      _id: oid(ID_A),
      employeeId: oid(ID_B),
      status: "pending_approval",
      month: 7,
      year: 2026,
    });
    Employee.findById.mockResolvedValue({
      _id: oid(ID_B),
      fullName: "Alice",
      email: "alice@example.com",
    });

    await sendPayslipEmailHandler(req, res, next);

    expect(sendPayslipEmail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].status).toBe("pending_approval");
  });

  test("refuses to email a payslip for a rejected row", async () => {
    req = { userId: OWNER, params: { id: ID_A } };
    PayrollUpdate.findOne.mockResolvedValue({
      _id: oid(ID_A),
      employeeId: oid(ID_B),
      status: "rejected",
    });
    Employee.findById.mockResolvedValue({
      _id: oid(ID_B),
      fullName: "Alice",
      email: "alice@example.com",
    });

    await sendPayslipEmailHandler(req, res, next);

    expect(sendPayslipEmail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test("sends for an approved row", async () => {
    req = { userId: OWNER, params: { id: ID_A } };
    PayrollUpdate.findOne.mockResolvedValue({
      _id: oid(ID_A),
      employeeId: oid(ID_B),
      status: "approved",
      month: 7,
      year: 2026,
    });
    Employee.findById.mockResolvedValue({
      _id: oid(ID_B),
      fullName: "Alice",
      email: "alice@example.com",
    });
    PayrollUpdate.updateOne.mockResolvedValue({});

    await sendPayslipEmailHandler(req, res, next);

    expect(sendPayslipEmail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("bulk dispatch filters on payable statuses at the query level", async () => {
    req = { userId: OWNER, body: { month: 7, year: 2026 }, query: {} };
    PayrollUpdate.find.mockResolvedValue([]);

    await sendAllPayslipsEmailHandler(req, res, next);

    expect(PayrollUpdate.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ["approved", "paid", "finalized"] },
        payslipEmailed: false,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("cross-tenant isolation, end to end (#458)", () => {
  test("account B approving account A's ids writes nothing and leaks nothing", async () => {
    jest.clearAllMocks();

    // Account A's row exists in the collection...
    const accountARow = payrollRow(ID_A, "pending_approval", {
      createdBy: oid(OWNER),
      employeeName: "A's employee",
      netSalary: 999999,
    });

    // ...but the scoped read on behalf of B returns nothing, because the
    // controller now includes `createdBy: B` in the filter.
    PayrollUpdate.find.mockImplementation((filter) => {
      const matches =
        String(filter.createdBy) === OWNER ? [accountARow] : [];
      return selectMock(matches);
    });
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 0 });

    const req = { userId: OTHER_OWNER, body: { payrollIds: [ID_A] } };
    const res = makeRes();

    await approvePayroll(req, res, jest.fn());

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);

    const payload = res.json.mock.calls[0][0];
    expect(payload.approvedCount).toBe(0);
    // Crucially, nothing about A's record — not the name, not the amount — is
    // echoed back to B.
    expect(JSON.stringify(payload)).not.toContain("A's employee");
    expect(JSON.stringify(payload)).not.toContain("999999");
  });
});

describe("the approval trail is actually persisted (#559)", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: OWNER, body: {} };
    res = makeRes();
    next = jest.fn();
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 1 });
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "pending_approval")]),
    );
    PayrollUpdate.countDocuments.mockResolvedValue(0);
    PayrollUpdate.aggregate.mockResolvedValue([]);
  });

  test("the approvals queue populates the submitter without throwing", async () => {
    // `.populate("submittedBy", …)` used to raise StrictPopulateError, because
    // the path was not on the schema — a 500 on every request to the queue.
    const chain = listMock([]);
    PayrollUpdate.find.mockReturnValue(chain);

    await getPendingApprovals({ userId: OWNER, query: {} }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(chain.populate).toHaveBeenCalledWith("submittedBy", "fullName email");
  });

  test("approving records who approved it and when", async () => {
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    const [, update] = PayrollUpdate.updateMany.mock.calls[0];
    expect(update.$set.status).toBe("approved");
    expect(update.$set.approvedBy).toBe(OWNER);
    expect(update.$set.approvedAt).toBeInstanceOf(Date);
  });

  test("approving clears any stale rejection rather than silently keeping it", async () => {
    req.body = { payrollIds: [ID_A] };

    await approvePayroll(req, res, next);

    const [, update] = PayrollUpdate.updateMany.mock.calls[0];
    expect(update.$unset).toEqual({
      rejectionReason: "",
      rejectedBy: "",
      rejectedAt: "",
    });
  });

  test("a transition with nothing to clear sends no $unset", async () => {
    req.body = { payrollIds: [ID_A] };
    PayrollUpdate.find.mockImplementation(() =>
      selectMock([payrollRow(ID_A, "approved")]),
    );

    await markPayrollPaid(req, res, next);

    const [, update] = PayrollUpdate.updateMany.mock.calls[0];
    expect(update.$unset).toBeUndefined();
  });

  test("every field the model writes exists on the schema", () => {
    // The root cause: the controller and the schema disagreed about which
    // fields exist, and mongoose reports that disagreement by dropping the
    // write. Anything the approval handlers set has to be declared.
    const written = [
      "submittedBy",
      "submittedAt",
      "approvedBy",
      "approvedAt",
      "rejectedBy",
      "rejectedAt",
      "rejectionReason",
    ];

    const RealPayrollUpdate = jest.requireActual("../../models/payroll.model");

    written.forEach((field) => {
      expect(RealPayrollUpdate.schema.path(field)).toBeDefined();
    });
  });
});
