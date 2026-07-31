const Employee = require("../../models/employee.model");
const logger = require("../../utils/logger");
const {
  migrateEmployeeEmailIndex,
  unsetBlankEmails,
  findDuplicateEmails,
  dropLegacyIndex,
  INDEX_NAME,
} = require("../fixEmployeeEmailIndex");

jest.mock("../../models/employee.model", () => ({
  updateMany: jest.fn(),
  aggregate: jest.fn(),
  syncIndexes: jest.fn(),
  collection: {
    indexes: jest.fn(),
    dropIndex: jest.fn(),
  },
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

describe("unsetBlankEmails", () => {
  beforeEach(() => jest.clearAllMocks());

  test("unsets empty-string and null addresses", async () => {
    Employee.updateMany.mockResolvedValue({ modifiedCount: 4 });

    const updated = await unsetBlankEmails();

    expect(Employee.updateMany).toHaveBeenCalledWith(
      { email: { $in: ["", null] } },
      { $unset: { email: "" } },
    );
    expect(updated).toBe(4);
  });

  test("returns 0 when nothing needs changing", async () => {
    Employee.updateMany.mockResolvedValue({});

    await expect(unsetBlankEmails()).resolves.toBe(0);
  });
});

describe("findDuplicateEmails", () => {
  beforeEach(() => jest.clearAllMocks());

  test("groups by company and address, keeping only counts above one", async () => {
    Employee.aggregate.mockResolvedValue([]);

    await findDuplicateEmails();

    const [pipeline] = Employee.aggregate.mock.calls[0];
    expect(pipeline[0]).toEqual({
      $match: { email: { $type: "string" } },
    });
    expect(pipeline).toContainEqual({ $match: { count: { $gt: 1 } } });
  });

  test("returns the offending groups", async () => {
    const duplicates = [
      { createdBy: "u1", email: "dup@acme.com", count: 2 },
    ];
    Employee.aggregate.mockResolvedValue(duplicates);

    await expect(findDuplicateEmails()).resolves.toEqual(duplicates);
  });
});

describe("dropLegacyIndex", () => {
  beforeEach(() => jest.clearAllMocks());

  test("drops the old sparse index", async () => {
    Employee.collection.indexes.mockResolvedValue([
      { name: "_id_" },
      { name: INDEX_NAME, unique: true, sparse: true },
    ]);

    await expect(dropLegacyIndex()).resolves.toBe(true);
    expect(Employee.collection.dropIndex).toHaveBeenCalledWith(INDEX_NAME);
  });

  test("leaves an already-migrated partial index alone", async () => {
    Employee.collection.indexes.mockResolvedValue([
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: { email: { $type: "string" } },
      },
    ]);

    await expect(dropLegacyIndex()).resolves.toBe(false);
    expect(Employee.collection.dropIndex).not.toHaveBeenCalled();
  });

  test("is a no-op when the index does not exist", async () => {
    Employee.collection.indexes.mockResolvedValue([{ name: "_id_" }]);

    await expect(dropLegacyIndex()).resolves.toBe(false);
    expect(Employee.collection.dropIndex).not.toHaveBeenCalled();
  });
});

describe("migrateEmployeeEmailIndex", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Employee.updateMany.mockResolvedValue({ modifiedCount: 2 });
    Employee.aggregate.mockResolvedValue([]);
    Employee.collection.indexes.mockResolvedValue([
      { name: INDEX_NAME, unique: true, sparse: true },
    ]);
    Employee.collection.dropIndex.mockResolvedValue({});
    Employee.syncIndexes.mockResolvedValue({});
  });

  test("unsets blanks, drops the old index and rebuilds", async () => {
    const result = await migrateEmployeeEmailIndex();

    expect(result).toEqual({
      ok: true,
      blankEmailsUnset: 2,
      indexDropped: true,
      duplicates: [],
    });
    expect(Employee.syncIndexes).toHaveBeenCalled();
  });

  test("aborts and reports when duplicate addresses exist", async () => {
    // Deciding which record keeps a duplicated address is a business call, so
    // the migration surfaces it rather than mutating data.
    const duplicates = [{ createdBy: "u1", email: "dup@acme.com", count: 2 }];
    Employee.aggregate.mockResolvedValue(duplicates);

    const result = await migrateEmployeeEmailIndex();

    expect(result.ok).toBe(false);
    expect(result.duplicates).toEqual(duplicates);
    expect(Employee.collection.dropIndex).not.toHaveBeenCalled();
    expect(Employee.syncIndexes).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("duplicate addresses exist"),
      { duplicates },
    );
  });

  test("is idempotent — a second run finds nothing left to drop", async () => {
    await migrateEmployeeEmailIndex();

    Employee.updateMany.mockResolvedValue({ modifiedCount: 0 });
    Employee.collection.indexes.mockResolvedValue([
      {
        name: INDEX_NAME,
        unique: true,
        partialFilterExpression: { email: { $type: "string" } },
      },
    ]);

    const second = await migrateEmployeeEmailIndex();

    expect(second).toEqual({
      ok: true,
      blankEmailsUnset: 0,
      indexDropped: false,
      duplicates: [],
    });
  });

  test("never throws when the database fails", async () => {
    Employee.updateMany.mockRejectedValue(new Error("Mongo unreachable"));

    await expect(migrateEmployeeEmailIndex()).resolves.toEqual(
      expect.objectContaining({ ok: false, error: "Mongo unreachable" }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Employee email index migration failed",
      { error: "Mongo unreachable" },
    );
  });
});
