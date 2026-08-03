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

/**
 * The migration talks to the raw collection, not to the model: `role` is an
 * ObjectId path, so mongoose would cast `{ role: { $in: ["ADMIN", …] } }` and
 * throw a CastError on the very queries this migration has to run.
 */
const collection = {
  countDocuments: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn(),
  find: jest.fn(),
};
User.collection = collection;
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("backfillAccountType — talks to the driver, not the schema (#558)", () => {
  test("does not query the model, whose ObjectId cast would reject these filters", async () => {
    collection.countDocuments.mockResolvedValue(0);

    await surveyAccounts();

    expect(collection.countDocuments).toHaveBeenCalledTimes(3);
    expect(User.countDocuments).not.toHaveBeenCalled();
  });

  test("looks for account-type strings and stringified ids in role", async () => {
    collection.countDocuments.mockResolvedValue(0);

    await surveyAccounts();

    const filters = collection.countDocuments.mock.calls.map(([f]) => f);
    expect(filters[0]).toEqual({ role: { $in: ["ADMIN", "EMPLOYEE"] } });
    expect(filters[1].role).toBeInstanceOf(RegExp);
  });
});

describe("backfillAccountType — survey (#558)", () => {
  test("counts each shape that needs repairing", async () => {
    collection.countDocuments
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
    collection.updateMany.mockResolvedValue({ modifiedCount: 4 });

    const moved = await moveAccountTypeOutOfRole();

    expect(moved).toBe(8); // 4 per account type, two types
    expect(collection.updateMany).toHaveBeenCalledTimes(2);

    const [filter, pipeline] = collection.updateMany.mock.calls[0];
    expect(filter).toEqual({ role: "ADMIN" });
    expect(pipeline).toContainEqual({ $unset: "role" });
  });

  test("does not clobber an accountType that is already set", async () => {
    collection.updateMany.mockResolvedValue({ modifiedCount: 0 });

    await moveAccountTypeOutOfRole();

    const [, pipeline] = collection.updateMany.mock.calls[0];
    expect(JSON.stringify(pipeline)).toContain("$ifNull");
  });
});

describe("backfillAccountType — recasting stringified role references", () => {
  test("turns a 24-hex-character string back into an ObjectId", async () => {
    const id = new mongoose.Types.ObjectId();
    const roleId = new mongoose.Types.ObjectId();

    collection.find.mockReturnValue({
      project: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ _id: id, role: String(roleId) }]),
      }),
    });
    collection.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const recast = await recastStringifiedRoles();

    expect(recast).toBe(1);

    const [filter, update] = collection.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: id });
    expect(update.$set.role).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(update.$set.role)).toBe(String(roleId));
  });

  test("is a no-op when nothing was ever repaired in place", async () => {
    collection.find.mockReturnValue({
      project: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      }),
    });

    expect(await recastStringifiedRoles()).toBe(0);
    expect(collection.updateOne).not.toHaveBeenCalled();
  });
});

describe("backfillAccountType — stamping the missing type", () => {
  test("derives EMPLOYEE from a link to an employee record, ADMIN otherwise", async () => {
    collection.updateMany
      .mockResolvedValueOnce({ modifiedCount: 2 }) // employees
      .mockResolvedValueOnce({ modifiedCount: 7 }); // admins

    const stamped = await stampMissingAccountTypes();

    expect(stamped).toEqual({ employees: 2, admins: 7 });

    const [employeeFilter, employeeUpdate] = collection.updateMany.mock.calls[0];
    expect(employeeFilter.employeeId).toEqual({ $exists: true, $ne: null });
    expect(employeeUpdate).toEqual({ $set: { accountType: "EMPLOYEE" } });

    const [, adminUpdate] = collection.updateMany.mock.calls[1];
    expect(adminUpdate).toEqual({ $set: { accountType: "ADMIN" } });
  });

  test("only touches accounts that have no type yet, so re-running is a no-op", async () => {
    collection.updateMany.mockResolvedValue({ modifiedCount: 0 });

    await stampMissingAccountTypes();

    const [filter] = collection.updateMany.mock.calls[0];
    expect(filter.$or).toEqual([
      { accountType: { $exists: false } },
      { accountType: null },
    ]);
  });
});

describe("backfillAccountType — orchestration", () => {
  const stubAll = () => {
    collection.countDocuments.mockResolvedValue(0);
    collection.updateMany.mockResolvedValue({ modifiedCount: 0 });
    collection.find.mockReturnValue({
      project: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
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
    collection.countDocuments.mockRejectedValue(new Error("DB exploded"));

    const result = await backfillAccountType();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("DB exploded");
  });
});
