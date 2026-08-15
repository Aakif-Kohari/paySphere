const {
  ACCOUNT_TYPE,
  ALL_ACCOUNT_TYPES,
  DEFAULT_ACCOUNT_TYPE,
  resolveAccountType,
  isAccountType,
} = require("../accountTypes");

describe("account type vocabulary (#558)", () => {
  test("declares exactly the two types the portal distinguishes", () => {
    expect(ALL_ACCOUNT_TYPES).toEqual(["ADMIN", "EMPLOYEE"]);
  });

  test("an account that registered a company defaults to the owner console", () => {
    expect(DEFAULT_ACCOUNT_TYPE).toBe(ACCOUNT_TYPE.ADMIN);
  });

  test("isAccountType accepts the known values and nothing else", () => {
    expect(isAccountType("ADMIN")).toBe(true);
    expect(isAccountType("EMPLOYEE")).toBe(true);

    expect(isAccountType("admin")).toBe(false);
    expect(isAccountType("SuperAdmin")).toBe(false);
    expect(isAccountType("")).toBe(false);
    expect(isAccountType(null)).toBe(false);
    expect(isAccountType(undefined)).toBe(false);
    expect(isAccountType({ toString: () => "ADMIN" })).toBe(false);
  });
});

describe("resolveAccountType", () => {
  test("returns null when there is no account", () => {
    expect(resolveAccountType(null)).toBeNull();
    expect(resolveAccountType(undefined)).toBeNull();
    expect(resolveAccountType("ADMIN")).toBeNull();
  });

  test("uses accountType when it is set", () => {
    expect(resolveAccountType({ accountType: "EMPLOYEE" })).toBe("EMPLOYEE");
    expect(resolveAccountType({ accountType: "ADMIN" })).toBe("ADMIN");
  });

  test("accountType wins over anything left in role", () => {
    const account = {
      accountType: "EMPLOYEE",
      role: "68f3ac1e5b2d4c0012ab34cd",
      employeeId: null,
    };

    expect(resolveAccountType(account)).toBe("EMPLOYEE");
  });

  test("falls back to a legacy account type stranded in role", () => {
    // Accounts written before the fields were separated carry the type in
    // `role`. The middleware has to stay correct on a database the migration
    // has not reached yet.
    expect(resolveAccountType({ role: "EMPLOYEE" })).toBe("EMPLOYEE");
    expect(resolveAccountType({ role: "ADMIN" })).toBe("ADMIN");
  });

  test("never mistakes an RBAC role reference for an account type", () => {
    // This is the fail-open case: the old guard compared `role` against
    // "ADMIN"/"EMPLOYEE", missed, and then defaulted to "ADMIN" anyway.
    const linked = { role: "68f3ac1e5b2d4c0012ab34cd", employeeId: "emp-1" };

    expect(resolveAccountType(linked)).toBe("EMPLOYEE");
  });

  test("derives EMPLOYEE from a link to an employee record", () => {
    expect(resolveAccountType({ employeeId: "emp-1" })).toBe("EMPLOYEE");
  });

  test("derives ADMIN for an account bound to no employee record", () => {
    expect(resolveAccountType({})).toBe("ADMIN");
    expect(resolveAccountType({ employeeId: null })).toBe("ADMIN");
  });
});
