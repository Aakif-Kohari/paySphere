const Employee = require("../employee.model");

/**
 * These assert the *index declarations* on the schema, not database behaviour.
 * The bug in #414 was entirely in how the index was declared, so pinning the
 * declaration down is what stops it regressing.
 */
describe("Employee schema — email uniqueness index (#414)", () => {
  const emailIndex = () =>
    Employee.schema
      .indexes()
      .find(([fields]) => "email" in fields && "createdBy" in fields);

  test("declares a compound index on email + createdBy", () => {
    const index = emailIndex();

    expect(index).toBeDefined();
    const [fields] = index;
    expect(fields).toEqual({ email: 1, createdBy: 1 });
  });

  test("the index is unique", () => {
    const [, options] = emailIndex();
    expect(options.unique).toBe(true);
  });

  test("does not use `sparse`, which is broken on a compound index", () => {
    // A compound sparse index covers a document that has *at least one* of the
    // indexed keys. `createdBy` is required, so every employee was indexed with
    // email: null and the second email-less employee hit E11000.
    const [, options] = emailIndex();
    expect(options.sparse).toBeUndefined();
  });

  test("uses a partialFilterExpression restricted to string emails", () => {
    const [, options] = emailIndex();

    expect(options.partialFilterExpression).toEqual({
      email: { $type: "string" },
    });
  });

  test("the partial filter excludes documents with no email", () => {
    const [, options] = emailIndex();
    const filter = options.partialFilterExpression;

    // Mirrors how MongoDB decides whether a document belongs in the index:
    // { $type: "string" } matches only when the field holds an actual string.
    const matches = (doc) => typeof doc.email === filter.email.$type;

    expect(matches({ email: "a@b.com" })).toBe(true);
    expect(matches({})).toBe(false);
    expect(matches({ email: null })).toBe(false);
    expect(matches({ email: undefined })).toBe(false);
  });

  test("still declares the name/role uniqueness index from #286", () => {
    const index = Employee.schema
      .indexes()
      .find(([fields]) => "fullName" in fields && "role" in fields);

    expect(index).toBeDefined();
    expect(index[1].unique).toBe(true);
  });

  test("email is optional on the schema", () => {
    expect(Employee.schema.path("email").isRequired).toBeFalsy();
  });

  test("email has no default, so an omitted address stays absent", () => {
    // A default of "" would put every email-less employee back into the same
    // index bucket.
    expect(Employee.schema.path("email").defaultValue).toBeUndefined();
  });
});

describe("Employee schema — soft delete field (#445)", () => {
  test("declares deletedAt field with Date type and null default", () => {
    const deletedAtPath = Employee.schema.path("deletedAt");
    expect(deletedAtPath).toBeDefined();
    expect(deletedAtPath.instance).toBe("Date");
    expect(deletedAtPath.defaultValue).toBeNull();
  });
});
