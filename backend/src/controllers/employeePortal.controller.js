const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const User = require("../models/user.model");
const { resolveAccountType } = require("../config/accountTypes");
const { payableStatusFilter } = require("../config/payrollStatus");
const logger = require("../utils/logger");

/**
 * The employee fields the portal is allowed to show its owner.
 *
 * A projection rather than the whole document: the portal renders a profile
 * card, and everything outside this list — bank details in particular — has no
 * reason to cross the wire for it.
 */
const EMPLOYEE_PROFILE_FIELDS =
  "fullName email role department joiningDate dateOfBirth currency employmentStatus tenantId";

/** The payslip fields the portal renders. Excludes the internal audit trail. */
const PAYSLIP_FIELDS =
  "month year currency baseSalary leaveDays overtimeHours overtimePay bonus deductions customDeductions leaveDeduction loanRecoveryTotal netSalary status createdAt";

const MAX_PAYSLIP_PAGE_SIZE = 50;
const DEFAULT_PAYSLIP_PAGE_SIZE = 12;

/**
 * Resolve the Employee record a portal login speaks for, and the tenant it
 * belongs to.
 *
 * Both handlers used to do this:
 *
 *     employee = await Employee.findOne({ email: user.email });
 *
 * PaySphere is multi-tenant by `tenantId`, and `Employee.email` is only unique
 * *within* a tenant — the partial index is `{ email: 1, tenantId: 1 }`. The
 * same address can therefore legitimately exist in two companies' directories,
 * and an unscoped `findOne` returns whichever document Mongo reaches first,
 * with no regard for who is asking. That served another company's salary, bank
 * details and full payslip history to the wrong person (#561).
 *
 * There are only two honest anchors:
 *
 *   1. `user.employeeId`, which an administrator set deliberately when they
 *      linked the login to a record. The record's own `tenantId` is then the
 *      tenant, and nothing has to be guessed.
 *   2. For an owner account — one with no employee link — their own company's
 *      directory, scoped by the tenant on their account. An owner who also
 *      appears in their own employee list still sees themself.
 *
 * The anchors moved from `createdBy` to `tenantId` when #585 made the latter
 * the scoping key; leaving them behind pointed the portal at a field nothing
 * writes any more (#613).
 *
 * An unlinked login belonging to nobody's directory has no anchor at all, and
 * matching it on an email address is guessing. It gets nothing.
 *
 * @param {object} user the authenticated User document
 * @returns {Promise<{employee: object|null, tenantId: string|null}>}
 */
async function resolveLinkedEmployee(user) {
  if (user.employeeId) {
    const employee = await Employee.findById(user.employeeId).select(
      EMPLOYEE_PROFILE_FIELDS,
    );

    if (!employee) {
      logger.warn("Portal login points at an employee record that is gone", {
        userId: String(user._id),
        employeeId: String(user.employeeId),
      });
      return { employee: null, tenantId: null };
    }

    return { employee, tenantId: employee.tenantId ? String(employee.tenantId) : null };
  }

  // No link. Only an owner can be resolved from here, and only inside their own
  // directory.
  if (!user.tenantId) return { employee: null, tenantId: null };

  const employee = await Employee.findOne({
    email: user.email,
    tenantId: user.tenantId,
  }).select(EMPLOYEE_PROFILE_FIELDS);

  return employee
    ? { employee, tenantId: String(user.tenantId) }
    : { employee: null, tenantId: null };
}

// GET EMPLOYEE PROFILE (Self-service)
exports.getEmployeeProfile = async (req, res, next) => {
  try {
    // `select("-password")` pulled resetPasswordToken, resetPasswordExpires,
    // googleId, tokenVersion and the base64 company logo into memory to return
    // four fields.
    // `accountType` rather than `role`: they are separate fields again, and the
    // one the portal reports is the account type (#558). `employeeId` is
    // selected because `resolveAccountType` derives from it when the type has
    // not been backfilled yet.
    const user = await User.findById(req.userId).select(
      "fullName email accountType companyName employeeId",
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    const { employee } = await resolveLinkedEmployee(user);

    res.status(200).json({
      user: {
        fullName: user.fullName,
        email: user.email,
        // The account type, not the RBAC role reference — `user.role` is an
        // ObjectId now that the two are separate fields again (#558).
        role: resolveAccountType(user),
        companyName: user.companyName,
      },
      employee: employee || null,
    });
  } catch (error) {
    next(error);
  }
};

// GET MY PAYSLIPS (Self-service history)
exports.getMyPayslips = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("email employeeId");
    if (!user) return res.status(404).json({ message: "User not found" });

    const { employee, tenantId } = await resolveLinkedEmployee(user);

    if (!employee || !tenantId) {
      return res.status(200).json({
        payrolls: [],
        page: 1,
        limit: DEFAULT_PAYSLIP_PAGE_SIZE,
        totalCount: 0,
        message: "This login is not linked to an employee record",
      });
    }

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > MAX_PAYSLIP_PAGE_SIZE) {
      limit = DEFAULT_PAYSLIP_PAGE_SIZE;
    }

    const query = {
      employeeId: employee._id,
      // Belt and braces alongside the resolution above: even if a link were
      // ever pointed at another tenant's record, the payroll rows still have to
      // belong to the tenant that owns the employee.
      tenantId,
      // A pending row is a figure no checker has signed off, and a rejected one
      // has been thrown out. Neither is a payslip. Every other read path that
      // reports money already filters this way.
      ...payableStatusFilter(),
    };

    const [payrolls, totalCount] = await Promise.all([
      PayrollUpdate.find(query)
        .select(PAYSLIP_FIELDS)
        .sort({ year: -1, month: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PayrollUpdate.countDocuments(query),
    ]);

    res.status(200).json({
      payrolls,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.resolveLinkedEmployee = resolveLinkedEmployee;
