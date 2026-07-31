const {
  PAYROLL_STATUS,
  ALL_STATUSES,
  PAYABLE_STATUSES,
  ALLOWED_TRANSITIONS,
  normalizeStatus,
  isValidStatus,
  canTransition,
  describeTransition,
  isPayable,
  isEmailable,
  payableStatusFilter,
  excludeRejectedFilter,
} = require("../payrollStatus");

describe("payrollStatus — vocabulary (#458)", () => {
  test("exposes the five lifecycle states", () => {
    expect(ALL_STATUSES).toEqual([
      "draft",
      "pending_approval",
      "approved",
      "rejected",
      "paid",
    ]);
  });

  test("every status has a transition list, so the table is total", () => {
    ALL_STATUSES.forEach((status) => {
      expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
    });
  });

  test("every declared target is itself a known status", () => {
    Object.values(ALLOWED_TRANSITIONS)
      .flat()
      .forEach((target) => {
        expect(ALL_STATUSES).toContain(target);
      });
  });
});

describe("payrollStatus — normalizeStatus", () => {
  test("passes canonical values through unchanged", () => {
    ALL_STATUSES.forEach((status) => {
      expect(normalizeStatus(status)).toBe(status);
    });
  });

  test('maps the pre-#438 "finalized" onto approved, not pending', () => {
    // Rows written before a checker existed were already payable. Demoting
    // them to pending would erase historical payroll from every total.
    expect(normalizeStatus("finalized")).toBe(PAYROLL_STATUS.APPROVED);
    expect(normalizeStatus("FINALIZED")).toBe(PAYROLL_STATUS.APPROVED);
  });

  test("maps the screaming-snake spellings written by #438", () => {
    expect(normalizeStatus("PENDING_APPROVAL")).toBe(
      PAYROLL_STATUS.PENDING_APPROVAL,
    );
    expect(normalizeStatus("APPROVED")).toBe(PAYROLL_STATUS.APPROVED);
    expect(normalizeStatus("REJECTED")).toBe(PAYROLL_STATUS.REJECTED);
    expect(normalizeStatus("PAID")).toBe(PAYROLL_STATUS.PAID);
  });

  test("tolerates surrounding whitespace", () => {
    expect(normalizeStatus("  approved  ")).toBe(PAYROLL_STATUS.APPROVED);
  });

  test("returns null for unknown and non-string input", () => {
    [
      "nonsense",
      "",
      "   ",
      null,
      undefined,
      42,
      {},
      [],
      { $ne: null },
    ].forEach((value) => {
      expect(normalizeStatus(value)).toBeNull();
    });
  });

  test("isValidStatus agrees with normalizeStatus", () => {
    expect(isValidStatus("finalized")).toBe(true);
    expect(isValidStatus("approved")).toBe(true);
    expect(isValidStatus("nonsense")).toBe(false);
    expect(isValidStatus(null)).toBe(false);
  });
});

describe("payrollStatus — canTransition", () => {
  test("a submitted run can be approved or rejected", () => {
    expect(
      canTransition(PAYROLL_STATUS.PENDING_APPROVAL, PAYROLL_STATUS.APPROVED),
    ).toBe(true);
    expect(
      canTransition(PAYROLL_STATUS.PENDING_APPROVAL, PAYROLL_STATUS.REJECTED),
    ).toBe(true);
  });

  test("an approved run can only be paid", () => {
    expect(canTransition(PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID)).toBe(
      true,
    );
    expect(
      canTransition(PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.REJECTED),
    ).toBe(false);
    expect(
      canTransition(PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PENDING_APPROVAL),
    ).toBe(false);
  });

  test("paid is terminal — #251 must not be reopened by the new workflow", () => {
    ALL_STATUSES.filter((s) => s !== PAYROLL_STATUS.PAID).forEach((target) => {
      expect(canTransition(PAYROLL_STATUS.PAID, target)).toBe(false);
    });
  });

  test("a rejected run goes back to pending when it is resubmitted", () => {
    expect(
      canTransition(PAYROLL_STATUS.REJECTED, PAYROLL_STATUS.PENDING_APPROVAL),
    ).toBe(true);
    // But it cannot jump straight to approved without a fresh submission.
    expect(canTransition(PAYROLL_STATUS.REJECTED, PAYROLL_STATUS.APPROVED)).toBe(
      false,
    );
    expect(canTransition(PAYROLL_STATUS.REJECTED, PAYROLL_STATUS.PAID)).toBe(
      false,
    );
  });

  test("a no-op transition is allowed so double-clicking approve is idempotent", () => {
    ALL_STATUSES.forEach((status) => {
      expect(canTransition(status, status)).toBe(true);
    });
  });

  test("legacy spellings are accepted on either side", () => {
    // A "finalized" row normalises to approved, so it can be marked paid.
    expect(canTransition("finalized", PAYROLL_STATUS.PAID)).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
  });

  test("unknown statuses can never transition", () => {
    expect(canTransition("nonsense", PAYROLL_STATUS.APPROVED)).toBe(false);
    expect(canTransition(PAYROLL_STATUS.APPROVED, "nonsense")).toBe(false);
    expect(canTransition(null, undefined)).toBe(false);
  });
});

describe("payrollStatus — describeTransition", () => {
  test("names the legal targets for a non-terminal status", () => {
    const message = describeTransition(
      PAYROLL_STATUS.PENDING_APPROVAL,
      PAYROLL_STATUS.PAID,
    );
    expect(message).toContain("approved");
    expect(message).toContain("rejected");
  });

  test("says a terminal status is final", () => {
    expect(
      describeTransition(PAYROLL_STATUS.PAID, PAYROLL_STATUS.APPROVED),
    ).toMatch(/final/i);
  });

  test("reports which side of the transition was unrecognised", () => {
    expect(describeTransition("nope", PAYROLL_STATUS.APPROVED)).toContain(
      "nope",
    );
    expect(describeTransition(PAYROLL_STATUS.APPROVED, "nope")).toContain(
      "nope",
    );
  });
});

describe("payrollStatus — payability", () => {
  test("only approved and paid count as money", () => {
    expect(PAYABLE_STATUSES).toEqual(["approved", "paid"]);
    expect(isPayable(PAYROLL_STATUS.APPROVED)).toBe(true);
    expect(isPayable(PAYROLL_STATUS.PAID)).toBe(true);
  });

  test("pending, rejected and draft are not payable", () => {
    expect(isPayable(PAYROLL_STATUS.PENDING_APPROVAL)).toBe(false);
    expect(isPayable(PAYROLL_STATUS.REJECTED)).toBe(false);
    expect(isPayable(PAYROLL_STATUS.DRAFT)).toBe(false);
  });

  test("legacy finalized rows stay payable after the rename", () => {
    expect(isPayable("finalized")).toBe(true);
  });

  test("a payslip may not be emailed for an unapproved or rejected row", () => {
    expect(isEmailable(PAYROLL_STATUS.APPROVED)).toBe(true);
    expect(isEmailable(PAYROLL_STATUS.PAID)).toBe(true);
    expect(isEmailable(PAYROLL_STATUS.PENDING_APPROVAL)).toBe(false);
    expect(isEmailable(PAYROLL_STATUS.REJECTED)).toBe(false);
  });
});

describe("payrollStatus — mongo filter fragments", () => {
  test("payableStatusFilter includes the legacy spelling so history survives", () => {
    const filter = payableStatusFilter();
    expect(filter.status.$in).toEqual(
      expect.arrayContaining(["approved", "paid", "finalized"]),
    );
    expect(filter.status.$in).not.toContain("pending_approval");
    expect(filter.status.$in).not.toContain("rejected");
  });

  test("excludeRejectedFilter excludes both spellings of rejected", () => {
    const filter = excludeRejectedFilter();
    expect(filter.status.$nin).toEqual(
      expect.arrayContaining(["rejected", "REJECTED"]),
    );
  });

  test("the fragments are fresh objects, so a caller cannot mutate shared state", () => {
    const first = payableStatusFilter();
    first.status.$in.push("rejected");
    expect(payableStatusFilter().status.$in).not.toContain("rejected");
  });
});
