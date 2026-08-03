const mongoose = require("mongoose");
const PayrollUpdate = require("../payroll.model");

/**
 * Regressions for #559.
 *
 * The approval workflow wrote six fields that were never declared on this
 * schema. Neither failure mode is loud: mongoose drops unknown `$set` keys
 * silently, and the `populate` that throws only throws on the one route nobody
 * had a test for. So these assertions go at the compiled schema directly.
 */
const AUDIT_REFS = ["submittedBy", "approvedBy", "rejectedBy"];
const AUDIT_DATES = ["submittedAt", "approvedAt", "rejectedAt"];

describe("PayrollUpdate schema — approval trail (#559)", () => {
  test.each(AUDIT_REFS)("%s is an ObjectId reference to User", (field) => {
    const path = PayrollUpdate.schema.path(field);

    expect(path).toBeDefined();
    expect(path.instance).toBe("ObjectId");
    expect(path.options.ref).toBe("User");
  });

  test.each(AUDIT_DATES)("%s is a Date", (field) => {
    const path = PayrollUpdate.schema.path(field);

    expect(path).toBeDefined();
    expect(path.instance).toBe("Date");
  });

  test("rejectionReason is a String capped at the controller's limit", () => {
    const path = PayrollUpdate.schema.path("rejectionReason");

    expect(path).toBeDefined();
    expect(path.instance).toBe("String");
    expect(path.options.maxlength[0]).toBe(500);
  });

  test("submittedBy can be populated — strictPopulate no longer throws", () => {
    // `getPendingApprovals` calls `.populate("submittedBy", "fullName email")`.
    // With the path absent, mongoose ≥6 throws StrictPopulateError and the
    // checker queue answered 500 on every request.
    expect(PayrollUpdate.schema.path("submittedBy").options.ref).toBe("User");
  });

  test("the audit fields survive a round trip through the document", () => {
    const approver = new mongoose.Types.ObjectId();
    const submitter = new mongoose.Types.ObjectId();

    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      status: "approved",
      submittedBy: submitter,
      submittedAt: new Date("2026-07-31T09:00:00Z"),
      approvedBy: approver,
      approvedAt: new Date("2026-08-01T10:00:00Z"),
    });

    expect(row.validateSync()).toBeUndefined();
    expect(String(row.submittedBy)).toBe(String(submitter));
    expect(String(row.approvedBy)).toBe(String(approver));
    expect(row.approvedAt.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  test("rejects a reason longer than the cap", () => {
    const row = new PayrollUpdate({
      employeeId: new mongoose.Types.ObjectId(),
      employeeName: "Ada Lovelace",
      month: 7,
      year: 2026,
      baseSalary: 90000,
      netSalary: 88000,
      createdBy: new mongoose.Types.ObjectId(),
      status: "rejected",
      rejectionReason: "x".repeat(501),
    });

    const error = row.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.rejectionReason).toBeDefined();
  });

  test("indexes the maker's own view of the queue", () => {
    const indexed = PayrollUpdate.schema
      .indexes()
      .some(
        ([fields]) =>
          fields.createdBy === 1 &&
          fields.submittedBy === 1 &&
          fields.status === 1,
      );

    expect(indexed).toBe(true);
  });
});
