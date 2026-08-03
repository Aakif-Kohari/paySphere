const mongoose = require("mongoose");
const User = require("../../models/user.model");
const {
  backfillAccountType,
  surveyAccounts,
  moveAccountTypeOutOfRole,
  recastStringifiedRoles,
  stampMissingAccountTypes,
} = require("../backfillAccountType");

jest.mock("../../models/user.model");
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("backfillAccountType — survey (#558)", () => {
  test("counts each shape that needs repairing", async () => {
    User.countDocuments
      .mockResolvedValueOnce(3) // account type stranded in role
      .mockResolvedValueOnce(2) // stringified ObjectId in role
      .mockResolvedValueOnce(9); // no accountType at all

    const survey = await surveyAccounts();

    expect(survey).toEqual({
      accountTypeInRole: 3,
      stringifiedRole: 2,
      missingAccountType: 9,
    });
  });
});

describe("backfillAccountType — moving the account type out of role", () => {
  test("moves each known type and unsets the role it was squatting in", async () => {
    User.updateMany.mockResolvedValue({ modifiedCount: 4 });

    const moved = await moveAccountTypeOutOfRole();

    expect(moved).toBe(8); // 4 per account type, two types
    expect(User.updateMany).toHaveBeenCalledTimes(2);

    const [filter, pipeline] = User.updateMany.mock.calls[0];
    expect(filter).toEqual({ role: "ADMIN" });
    expect(pipeline).toContainEqual({ $unset: "role" });
  });

  test("does not clobber an accountType that is already set", async () => {
    User.updateMany.mockResolvedValue({ modifiedCount: 0 });

    await moveAccountTypeOutOfRole();

    const [, pipeline] = User.updateMany.mock.calls[0];
    expect(JSON.stringify(pipeline)).toContain("$ifNull");
  });
});

describe("backfillAccountType — recasting stringified role references", () => {
  test("turns a 24-hex-character string back into an ObjectId", async () => {
    const id = new mongoose.Types.ObjectId();
    const roleId = new mongoose.Types.ObjectId();

    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: id, role: String(roleId) },
        ]),
      }),
    });
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const recast = await recastStringifiedRoles();

    expect(recast).toBe(1);

    const [filter, update] = User.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: id });
    expect(update.$set.role).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(update.$set.role)).toBe(String(roleId));
  });

  test("is a no-op when nothing was ever repaired in place", async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    expect(await recastStringifiedRoles()).toBe(0);
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});

describe("backfillAccountType — stamping the missing type", () => {
  test("derives EMPLOYEE from a link to an employee record, ADMIN otherwise", async () => {
    User.updateMany
      .mockResolvedValueOnce({ modifiedCount: 2 }) // employees
      .mockResolvedValueOnce({ modifiedCount: 7 }); // admins

    const stamped = await stampMissingAccountTypes();

    expect(stamped).toEqual({ employees: 2, admins: 7 });

    const [employeeFilter, employeeUpdate] = User.updateMany.mock.calls[0];
    expect(employeeFilter.employeeId).toEqual({ $exists: true, $ne: null });
    expect(employeeUpdate).toEqual({ $set: { accountType: "EMPLOYEE" } });

    const [, adminUpdate] = User.updateMany.mock.calls[1];
    expect(adminUpdate).toEqual({ $set: { accountType: "ADMIN" } });
  });

  test("only touches accounts that have no type yet, so re-running is a no-op", async () => {
    User.updateMany.mockResolvedValue({ modifiedCount: 0 });

    await stampMissingAccountTypes();

    const [filter] = User.updateMany.mock.calls[0];
    expect(filter.$or).toEqual([
      { accountType: { $exists: false } },
      { accountType: null },
    ]);
  });
});

describe("backfillAccountType — orchestration", () => {
  const stubAll = () => {
    User.countDocuments.mockResolvedValue(0);
    User.updateMany.mockResolvedValue({ modifiedCount: 0 });
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
  };

  test("reports what it did", async () => {
    stubAll();

    const result = await backfillAccountType();

    expect(result.ok).toBe(true);
    expect(result.survey).toEqual({
      accountTypeInRole: 0,
      stringifiedRole: 0,
      missingAccountType: 0,
    });
  });

  test("never throws — a boot-time migration must not stop the server", async () => {
    User.countDocuments.mockRejectedValue(new Error("DB exploded"));

    const result = await backfillAccountType();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("DB exploded");
  });
});
