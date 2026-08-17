const mongoose = require("mongoose");
const User = require("../user.model");

/**
 * Regressions for #558.
 *
 * The bug was a duplicate field declaration, which mongoose resolves silently —
 * no warning, no error, just the wrong path type. Nothing in the suite could
 * see it, so these assertions check the compiled schema directly. #297 and #370
 * were the same class of bug on the Employee schema; this is the same guard.
 */
describe("User schema — role and accountType are separate fields (#558)", () => {
  test("role is an ObjectId reference to Role", () => {
    const role = User.schema.path("role");

    expect(role.instance).toBe("ObjectId");
    expect(role.options.ref).toBe("Role");
  });

  test("role carries no enum — that belonged to the account type", () => {
    expect(User.schema.path("role").options.enum).toBeUndefined();
  });

  test("accountType is the ADMIN/EMPLOYEE discriminator", () => {
    const accountType = User.schema.path("accountType");

    expect(accountType.instance).toBe("String");
    expect(accountType.options.enum).toEqual(["ADMIN", "EMPLOYEE"]);
    expect(accountType.options.default).toBe("ADMIN");
  });

  test("assigning a seeded role id validates", () => {
    // The whole of signup hinged on this: `role: defaultRole._id` was cast to a
    // string and checked against enum ["ADMIN","EMPLOYEE"], so `save()` threw a
    // ValidationError and registration answered 400 on every seeded database.
    const user = new User({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      companyName: "Analytical Engines",
      password: "hashed",
      role: new mongoose.Types.ObjectId(),
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("a new account defaults to the owner console", () => {
    const user = new User({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      companyName: "Analytical Engines",
      password: "hashed",
    });

    expect(user.accountType).toBe("ADMIN");
  });

  test("rejects an account type outside the enum", () => {
    const user = new User({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      companyName: "Analytical Engines",
      password: "hashed",
      accountType: "SUPERUSER",
    });

    const error = user.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.accountType).toBeDefined();
  });

  test("an account type string is not accepted as a role", () => {
    const user = new User({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      companyName: "Analytical Engines",
      password: "hashed",
      role: "ADMIN",
    });

    const error = user.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.role).toBeDefined();
  });
});
