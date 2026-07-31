const PayrollUpdate = require("../../models/payroll.model");
const {
  backfillPayrollStatus,
  surveyLegacyStatuses,
  rewriteStatus,
  stampMigratedApprovals,
  buildRewriteMap,
} = require("../backfillPayrollStatus");

jest.mock("../../models/payroll.model");

describe("backfillPayrollStatus — rewrite map (#458)", () => {
  test("maps the pre-#438 finalized rows onto approved", () => {
    const map = buildRewriteMap();
    expect(map.finalized).toBe("approved");
    expect(map.FINALIZED).toBe("approved");
  });

  test("maps the screaming-snake spellings #438 wrote", () => {
    const map = buildRewriteMap();
    expect(map.PENDING_APPROVAL).toBe("pending_approval");
    expect(map.APPROVED).toBe("approved");
    expect(map.REJECTED).toBe("rejected");
    expect(map.PAID).toBe("paid");
    expect(map.DRAFT).toBe("draft");
  });

  test("does not include canonical values — rewriting them would be a pointless full-collection write", () => {
    const map = buildRewriteMap();
    ["draft", "pending_approval", "approved", "rejected", "paid"].forEach(
      (canonical) => {
        expect(map[canonical]).toBeUndefined();
      },
    );
  });

  test("every target is a canonical value", () => {
    const canonical = [
      "draft",
      "pending_approval",
      "approved",
      "rejected",
      "paid",
    ];
    Object.values(buildRewriteMap()).forEach((target) => {
      expect(canonical).toContain(target);
    });
  });
});

describe("backfillPayrollStatus — survey", () => {
  beforeEach(() => jest.clearAllMocks());

  test("counts documents per legacy spelling", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([
      { _id: "finalized", count: 42 },
      { _id: "PENDING_APPROVAL", count: 7 },
    ]);

    const survey = await surveyLegacyStatuses();

    expect(survey).toEqual({ finalized: 42, PENDING_APPROVAL: 7 });
  });

  test("matches only legacy spellings, never the canonical ones", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([]);

    await surveyLegacyStatuses();

    const [pipeline] = PayrollUpdate.aggregate.mock.calls[0];
    const matched = pipeline[0].$match.status.$in;
    expect(matched).toContain("finalized");
    expect(matched).not.toContain("approved");
    expect(matched).not.toContain("pending_approval");
  });

  test("returns an empty survey when nothing legacy remains", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([]);
    expect(await surveyLegacyStatuses()).toEqual({});
  });
});

describe("backfillPayrollStatus — rewrite", () => {
  beforeEach(() => jest.clearAllMocks());

  test("rewrites one spelling and reports the count", async () => {
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 12 });

    const modified = await rewriteStatus("finalized", "approved");

    expect(modified).toBe(12);
    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { status: "finalized" },
      { $set: { status: "approved" } },
    );
  });

  test("treats a missing modifiedCount as zero rather than NaN", async () => {
    PayrollUpdate.updateMany.mockResolvedValue({});
    expect(await rewriteStatus("finalized", "approved")).toBe(0);
  });
});

describe("backfillPayrollStatus — approval stamping", () => {
  beforeEach(() => jest.clearAllMocks());

  test("stamps approvedAt from the document's own timestamps, inventing no approver", async () => {
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 5 });

    const stamped = await stampMigratedApprovals();

    expect(stamped).toBe(5);
    const [filter, pipeline] = PayrollUpdate.updateMany.mock.calls[0];
    expect(filter.status.$in).toEqual(["approved", "paid"]);
    expect(filter.approvedAt).toEqual({ $exists: false });
    // approvedBy is deliberately left unset: nobody approved these rows.
    expect(JSON.stringify(pipeline)).not.toContain("approvedBy");
    expect(JSON.stringify(pipeline)).toContain("updatedAt");
  });

  test("only touches rows that have no approvedAt, so re-running is a no-op", async () => {
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 0 });

    await stampMigratedApprovals();

    const [filter] = PayrollUpdate.updateMany.mock.calls[0];
    expect(filter.approvedAt).toEqual({ $exists: false });
  });
});

describe("backfillPayrollStatus — end to end", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PayrollUpdate.aggregate.mockResolvedValue([{ _id: "finalized", count: 3 }]);
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 3 });
    PayrollUpdate.syncIndexes.mockResolvedValue([]);
  });

  test("reports the survey, the rewrites and the stamped approvals", async () => {
    const result = await backfillPayrollStatus();

    expect(result.ok).toBe(true);
    expect(result.survey).toEqual({ finalized: 3 });
    expect(result.rewritten["finalized -> approved"]).toBe(3);
    expect(result.totalRewritten).toBeGreaterThan(0);
  });

  test("rebuilds the indexes so the new compound keys are created", async () => {
    await backfillPayrollStatus();
    expect(PayrollUpdate.syncIndexes).toHaveBeenCalled();
  });

  test("never throws — a failed migration must not take the boot down", async () => {
    PayrollUpdate.aggregate.mockRejectedValue(new Error("connection lost"));

    const result = await backfillPayrollStatus();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connection lost");
    expect(result.totalRewritten).toBe(0);
  });

  test("is idempotent: a clean collection produces no writes worth reporting", async () => {
    PayrollUpdate.aggregate.mockResolvedValue([]);
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 0 });

    const result = await backfillPayrollStatus();

    expect(result.ok).toBe(true);
    expect(result.totalRewritten).toBe(0);
    expect(result.rewritten).toEqual({});
  });
});
