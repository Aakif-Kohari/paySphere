const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");
const { parse } = require("csv-parse");
const { isNonEmptyString, isValidEmail, escapeRegex, sanitizeText, MONTHLY_SALARY_MAX, OVERTIME_RATE_MAX, FULLNAME_MAX_LENGTH, ROLE_MAX_LENGTH } = require("../utils/validators");
const PayrollUpdate = require("../models/payroll.model");
const logger = require("../utils/logger");
const eventBus = require("../services/event.service");
const cacheService = require("../services/cache.service");
const Settlement = require("../models/settlement.model");
const { fullName, role, department, monthlySalary, overtimeRate, dateOfBirth, joiningDate, email, bankDetails } = req.body;


/**
 * Normalize an employee email for storage.
 *
 * Returns `undefined` for a blank/absent address rather than `""`, so the
 * partial unique index on { email, createdBy } skips the document entirely.
 * Storing empty strings would put every email-less employee back into the same
 * index bucket and re-create the duplicate-key collision (#414).
 *
 * @param {*} value raw value from the request body or a CSV cell
 * @returns {{ ok: true, value: string|undefined } | { ok: false }}
 */
function normalizeEmployeeEmail(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    // Explicitly clearing the address.
    return { ok: true, value: undefined };
  }
  if (!isValidEmail(value)) return { ok: false };
  return { ok: true, value: value.trim().toLowerCase() };
}

/**
 * Translate a duplicate-key violation on the employee email index into a 409
 * the client can act on, instead of leaking a raw driver error as a 500.
 *
 * @returns {boolean} true if the error was handled
 */
function handleDuplicateEmail(error, res) {
  if (error && error.code === 11000 && error.keyPattern && "email" in error.keyPattern) {
    res.status(409).json({
      message: "An employee with this email address already exists",
    });
    return true;
  }
  return false;
}
// ADD EMPLOYEE
exports.addEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { fullName, role, monthlySalary, overtimeRate, dateOfBirth, joiningDate, email, bankDetails } = req.body;

    if (!isNonEmptyString(fullName) || !isNonEmptyString(role)) {
      return res
        .status(400)
        .json({ message: 'Full name and role are required non-empty strings' });
    }

    const numSalary = Number(monthlySalary);
    if (
      monthlySalary === undefined ||
      monthlySalary === null ||
      isNaN(numSalary) ||
      !Number.isFinite(numSalary) ||
      numSalary <= 0
    ) {
      return res
        .status(400)
        .json({ message: 'Monthly salary must be a positive number' });
    }
    if (numSalary > MONTHLY_SALARY_MAX) {
      return res
        .status(400)
        .json({
          message: `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`,
        });
    }

    let numOvertime = 0;
    if (overtimeRate !== undefined && overtimeRate !== null) {
      numOvertime = Number(overtimeRate);
      if (
        isNaN(numOvertime) ||
        !Number.isFinite(numOvertime) ||
        numOvertime < 0
      ) {
        return res
          .status(400)
          .json({ message: 'Overtime rate must be a non-negative number' });
      }
      if (numOvertime > OVERTIME_RATE_MAX) {
        return res
          .status(400)
          .json({
            message: `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}`,
          });
      }
    }

    // `email` was destructured here and then never used, so every address sent
    // to this endpoint was silently discarded — which is why payslip email
    // delivery could never find an address to send to (#414).
    const normalizedEmail = normalizeEmployeeEmail(email);
    if (!normalizedEmail.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid email address format' });
    }

    // Get the user's company name
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const employee = new Employee({
      fullName: sanitizeText(fullName),
      role: sanitizeText(role),
      department: department ? sanitizeText(department) : '',
      monthlySalary: numSalary,
      overtimeRate: numOvertime,
      companyName: sanitizeText(user.companyName),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      createdBy: req.userId,
      ...(normalizedEmail.value ? { email: normalizedEmail.value } : {}),
    });

    // Optionally store bank details if provided
    if (bankDetails && typeof bankDetails === 'object') {
      employee.bankDetails = {
        bankName: sanitizeText(bankDetails.bankName || ''),
        accountNumber: sanitizeText(bankDetails.accountNumber || ''),
        routingCode: sanitizeText(bankDetails.routingCode || ''),
      };
    }

    await employee.save();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: 'EMPLOYEE_CREATE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
        role: employee.role,
        monthlySalary: employee.monthlySalary,
      },
      req,
    });

    logger.info(`Employee created`, {
      userId: req.userId,
      employeeId: employee._id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);
    res.status(201).json({ message: "Employee added successfully", employee });
  } catch (error) {
    if (handleDuplicateEmail(error, res)) return;
    next(error);
  }
};

// GET ALL EMPLOYEES (for the logged-in user's company)
exports.getEmployees = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;
    const includeInactive = req.query.includeInactive === 'true';
    const includeDeleted = req.query.includeDeleted === 'true';

    let search = req.query.search;
    if (typeof search !== 'string') search = '';
    search = sanitizeText(search);

    const skip = (page - 1) * limit;

    const query = {
      createdBy: req.userId,
    };

    if (!includeDeleted) {
      query.deletedAt = null;
    }

    if (!includeInactive) {
      query.isActive = true;
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { fullName: { $regex: safeSearch, $options: 'i' } },
        { role: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const totalEmployees = await Employee.countDocuments(query);

    const employees = await Employee.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalEmployees / limit);

    res.status(200).json({
      employees,
      currentPage: page,
      totalPages,
      totalEmployees,
    });
  } catch (error) {
    next(error);
  }
};

// GET RECENTLY ADDED EMPLOYEES (last 5)
exports.getRecentEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find({ createdBy: req.userId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({ employees });
  } catch (error) {
    next(error);
  }
};

exports.importEmployees = async (req, res, next) => {
  const sanitizedDepartment = record.department ? sanitizeText(record.department.trim()) : '';
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No CSV file uploaded',
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    const csvData = req.file.buffer.toString('utf-8');

    parse(
      csvData,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      },
      async (err, records) => {
        try {
          if (err) {
            return res.status(400).json({
              message: 'Invalid CSV format',
            });
          }

          // Fetch existing employees to detect duplicates by fullName + role
          // Extract unique names from the CSV to minimize database query size
          const csvNames = Array.from(
            new Set(records.map((r) => r.fullName?.trim()).filter(Boolean)),
          );

          // Use case-insensitive regex for the $in query to guarantee matching without specific collation
          const nameRegexes = csvNames.map(
            (name) =>
              new RegExp(
                '^' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '$',
                'i',
              ),
          );

          const existingEmployees =
            nameRegexes.length > 0
              ? await Employee.find({
                createdBy: req.userId,
                fullName: { $in: nameRegexes },
              }).select('fullName role')
              : [];

          const existingKeys = new Set(
            existingEmployees.map(
              (e) =>
                `${sanitizeText(e.fullName).toLowerCase()}|${sanitizeText(e.role).toLowerCase()}`,
            ),
          );

          const employees = [];
          const errors = [];
          const seenEmails = new Set();
          let skipped = 0;

          records.forEach((record, index) => {
            const rawName = record.fullName?.trim();
            const rawRole = record.role?.trim();
            const monthlySalary = Number(record.monthlySalary);
            const overtimeRate = Number(record.overtimeRate || 0);

            if (!rawName) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Full name is required' });
              return;
            }
            if (rawName.length > FULLNAME_MAX_LENGTH) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Full name exceeds maximum of ${FULLNAME_MAX_LENGTH} characters`,
              });
              return;
            }

            if (!rawRole) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Role is required' });
              return;
            }
            if (rawRole.length > ROLE_MAX_LENGTH) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Role exceeds maximum of ${ROLE_MAX_LENGTH} characters`,
              });
              return;
            }

            if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Invalid monthly salary' });
              return;
            }
            if (monthlySalary > MONTHLY_SALARY_MAX) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Monthly salary exceeds maximum of ${MONTHLY_SALARY_MAX}`,
              });
              return;
            }

            if (!Number.isFinite(overtimeRate) || overtimeRate < 0) {
              skipped++;
              errors.push({ row: index + 2, reason: 'Invalid overtime rate' });
              return;
            }
            if (overtimeRate > OVERTIME_RATE_MAX) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Overtime rate exceeds maximum of ${OVERTIME_RATE_MAX}`,
              });
              return;
            }

            // `isValidEmail` was called here without being imported, so any row
            // carrying an email threw ReferenceError and 500'd the whole import.
            const normalizedEmail = normalizeEmployeeEmail(record.email);
            if (!normalizedEmail.ok) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Invalid email format: "${record.email}"`,
              });
              return;
            }

            // Reject addresses duplicated within the file itself, before
            // insertMany turns it into an opaque E11000.
            if (normalizedEmail.value) {
              if (seenEmails.has(normalizedEmail.value)) {
                skipped++;
                errors.push({
                  row: index + 2,
                  reason: `Duplicate email in file: "${normalizedEmail.value}"`,
                });
                return;
              }
              seenEmails.add(normalizedEmail.value);
            }

            const sanitizedName = sanitizeText(rawName);
            const sanitizedRole = sanitizeText(rawRole);
            const key = `${sanitizedName.toLowerCase()}|${sanitizedRole.toLowerCase()}`;
            if (existingKeys.has(key)) {
              skipped++;
              errors.push({
                row: index + 2,
                reason:
                  'Duplicate employee (same name and role already exists)',
              });
              return;
            }

            existingKeys.add(key);

            employees.push({
              fullName: sanitizedName,
              role: sanitizedRole,
              department: sanitizedDepartment,
              monthlySalary,
              overtimeRate,
              companyName: sanitizeText(user.companyName),
              createdBy: req.userId,
              // The address was validated above and then dropped on the floor,
              // so imported employees never had an email either (#414, #236).
              ...(normalizedEmail.value ? { email: normalizedEmail.value } : {}),
            });
          });

          let createdIds = [];
          if (employees.length > 0) {
            let session = null;
            try {
              session = await mongoose.startSession();
              session.startTransaction();
              let created = [];
              try {
                created = await Employee.insertMany(employees, {
                  session,
                  ordered: false,
                });
              } catch (insertError) {
                if (insertError.code === 11000) {
                  skipped += insertError.writeErrors
                    ? insertError.writeErrors.length
                    : 1;
                  created = insertError.insertedDocs || [];
                } else {
                  throw insertError;
                }
              }
              createdIds = created.map((e) => e._id);
              await session.commitTransaction();
            } catch (txError) {
              if (session) {
                try {
                  await session.abortTransaction();
                } catch {
                  /* ignore */
                }
              }
              throw txError;
            } finally {
              if (session) session.endSession();
            }
          }

          const importedCount = createdIds.length;

          eventBus.emit("AUDIT_LOG", {
            userId: req.userId,
            action: 'EMPLOYEE_IMPORT',
            resourceType: 'Employee',
            resourceIds: createdIds,
            details: {
              imported: importedCount,
              skipped,
              totalErrors: errors.length,
              fileName: req.file?.originalname,
            },
            result:
              importedCount > 0
                ? errors.length > 0
                  ? 'partial'
                  : 'success'
                : 'failure',
            req,
          });

          logger.info(`Employee CSV import completed`, {
            userId: req.userId,
            imported: importedCount,
            skipped,
            totalErrors: errors.length,
          });

          return res.status(200).json({
            message: 'Employee import completed',
            imported: importedCount,
            skipped,
            errors,
          });
        } catch (dbError) {
          next(dbError);
        }
      },
    );
  } catch (error) {
    next(error);
  }
};

// UPDATE EMPLOYEE
exports.updateEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { id } = req.params;
    const { fullName, role, department, monthlySalary, overtimeRate, isActive, email, bankDetails } = req.body;
    if (department !== undefined) employee.department = sanitizeText(department);
    const employee = await Employee.findById(id);

    if (!employee || employee.deletedAt) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Ensure the logged-in user is the creator of this employee
    if (employee.createdBy.toString() !== req.userId) {
      return res
        .status(403)
        .json({ message: 'Not authorized to update this employee' });
    }

    // Validate fields if provided
    if (fullName !== undefined && !isNonEmptyString(fullName)) {
      return res
        .status(400)
        .json({ message: 'Full name must be a required non-empty string' });
    }
    if (role !== undefined && !isNonEmptyString(role)) {
      return res
        .status(400)
        .json({ message: 'Role must be a required non-empty string' });
    }

    if (
      monthlySalary !== undefined &&
      (isNaN(monthlySalary) ||
        !Number.isFinite(Number(monthlySalary)) ||
        monthlySalary <= 0)
    ) {
      return res
        .status(400)
        .json({ message: 'Monthly salary must be a positive number' });
    }
    if (
      monthlySalary !== undefined &&
      Number(monthlySalary) > MONTHLY_SALARY_MAX
    ) {
      return res
        .status(400)
        .json({
          message: `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`,
        });
    }

    if (
      overtimeRate !== undefined &&
      (isNaN(overtimeRate) ||
        !Number.isFinite(Number(overtimeRate)) ||
        overtimeRate < 0)
    ) {
      return res
        .status(400)
        .json({ message: 'Overtime rate must be a non-negative number' });
    }
    if (
      overtimeRate !== undefined &&
      Number(overtimeRate) > OVERTIME_RATE_MAX
    ) {
      return res
        .status(400)
        .json({ message: `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}` });
    }

    // Same as addEmployee: `email` was destructured and never applied (#414).
    const normalizedEmail = normalizeEmployeeEmail(email);
    if (!normalizedEmail.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid email address format' });
    }

    // Capture old name for payroll propagation check (#253)
    const oldName = employee.fullName;

    // Apply updates only for provided fields
    if (fullName !== undefined) employee.fullName = sanitizeText(fullName);
    if (role !== undefined) employee.role = sanitizeText(role);
    if (monthlySalary !== undefined) employee.monthlySalary = monthlySalary;
    if (overtimeRate !== undefined) employee.overtimeRate = overtimeRate;
    if (isActive !== undefined) employee.isActive = isActive;
    if (req.body.dateOfBirth !== undefined) employee.dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined;
    if (req.body.joiningDate !== undefined) employee.joiningDate = req.body.joiningDate ? new Date(req.body.joiningDate) : undefined;

    if (email !== undefined) {
      // `undefined` here means "clear it" — assigning undefined would be a no-op
      // in mongoose, so the path has to be unset explicitly.
      if (normalizedEmail.value) {
        employee.email = normalizedEmail.value;
      } else {
        employee.email = undefined;
        employee.markModified('email');
      }
    }

    // Patch bank details: merge only the provided sub-fields
    if (bankDetails && typeof bankDetails === 'object') {
      employee.bankDetails = {
        bankName: sanitizeText(bankDetails.bankName ?? employee.bankDetails?.bankName ?? ''),
        accountNumber: sanitizeText(bankDetails.accountNumber ?? employee.bankDetails?.accountNumber ?? ''),
        routingCode: sanitizeText(bankDetails.routingCode ?? employee.bankDetails?.routingCode ?? ''),
      };
    }

    await employee.save();

    // Propagate name change to finalized (unpaid) PayrollUpdate records (#253)
    if (fullName !== undefined && employee.fullName !== oldName) {
      try {
        const result = await PayrollUpdate.updateMany(
          { employeeId: id, createdBy: req.userId, status: 'finalized' },
          { $set: { employeeName: employee.fullName } },
        );
        logger.info(`PayrollUpdate employeeName propagated`, {
          userId: req.userId,
          employeeId: id,
          oldName,
          newName: employee.fullName,
          modifiedCount: result.modifiedCount,
        });
      } catch (propagateErr) {
        logger.error(`Failed to propagate employeeName to PayrollUpdate`, {
          userId: req.userId,
          employeeId: id,
          error: propagateErr.message,
        });
      }
    }

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: 'EMPLOYEE_UPDATE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
        role: employee.role,
        changes: Object.keys(req.body).filter((k) => k !== 'id'),
      },
      req,
    });

    logger.info(`Employee updated`, {
      userId: req.userId,
      employeeId: employee._id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);
    res.status(200).json({ message: "Employee updated successfully", employee });
  } catch (error) {
    if (handleDuplicateEmail(error, res)) return;
    next(error);
  }
};

// TOGGLE EMPLOYEE ACTIVE STATUS
exports.toggleEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const employee = await Employee.findById(id);

    if (!employee || employee.deletedAt) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (employee.createdBy.toString() !== req.userId) {
      return res
        .status(403)
        .json({ message: 'Not authorized to update this employee' });
    }

    employee.isActive = !employee.isActive;
    await employee.save();

    // Inactive employees are excluded from payroll (#260), so flipping this
    // changes the analytics aggregates and must clear the cache (#415).
    await cacheService.invalidateAnalytics(req.userId);

    // This was the only employee mutation with no audit event, unlike its
    // create/update/delete siblings.
    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: 'EMPLOYEE_STATUS_TOGGLE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
        isActive: employee.isActive,
      },
      req,
    });

    logger.info(`Employee status toggled`, {
      userId: req.userId,
      employeeId: employee._id,
      isActive: employee.isActive,
    });

    res.status(200).json({ message: 'Employee status updated', employee });
  } catch (error) {
    next(error);
  }
};

// DELETE EMPLOYEE (SOFT DELETE)
exports.deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const employee = await Employee.findById(id);

    if (!employee || employee.deletedAt) {
      return res.status(404).json({
        message: 'Employee not found',
      });
    }

    // Check ownership
    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        message: 'Not authorized to delete this employee',
      });
    }

    // Check if employee has historical "paid" payroll records (#345)
    const hasPaidPayroll = await PayrollUpdate.exists({
      employeeId: id,
      createdBy: req.userId,
      status: 'paid',
    });

    if (hasPaidPayroll) {
      return res.status(400).json({
        message: 'Cannot delete employee with historical paid payroll records',
      });
    }

    // Same principle as #345: an employee who has been formally settled has a
    // final statement on record, and destroying them would destroy the
    // counterpart to a payment that has already been made (#462).
    let hasSettlement = false;
    try {
      hasSettlement = Boolean(
        await Settlement.exists({
          employeeId: id,
          createdBy: req.userId,
          status: { $in: ['approved', 'paid'] },
        }),
      );
    } catch (settlementError) {
      // A lookup failure must not silently downgrade a protection.
      logger.error('Could not check for an existing settlement before deletion', {
        userId: req.userId,
        employeeId: id,
        error: settlementError.message,
      });
      return res.status(500).json({
        message: 'Could not verify settlement history. Deletion aborted.',
      });
    }

    if (hasSettlement) {
      return res.status(400).json({
        message:
          'Cannot delete an employee with an approved or paid full & final settlement',
      });
    }

    employee.deletedAt = new Date();
    employee.isActive = false;
    await employee.save();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: 'EMPLOYEE_DELETE',
      resourceType: 'Employee',
      resourceIds: [id],
      details: { fullName: employee.fullName, role: employee.role, deletedAt: employee.deletedAt },
      req,
    });

    logger.info(`Employee soft deleted`, {
      userId: req.userId,
      employeeId: id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);

    res.status(200).json({
      message: 'Employee deleted successfully',
      employee,
    });
  } catch (error) {
    next(error);
  }
};

// RESTORE SOFT-DELETED EMPLOYEE
exports.restoreEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const employee = await Employee.findById(id);

    if (!employee || !employee.deletedAt) {
      return res.status(404).json({ message: 'Soft-deleted employee not found' });
    }

    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to restore this employee' });
    }

    employee.deletedAt = null;
    employee.isActive = true;
    await employee.save();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: 'EMPLOYEE_RESTORE',
      resourceType: 'Employee',
      resourceIds: [id],
      details: { fullName: employee.fullName, role: employee.role },
      req,
    });

    logger.info(`Employee restored`, {
      userId: req.userId,
      employeeId: id,
      fullName: employee.fullName,
    });

    await cacheService.invalidateAnalytics(req.userId);

    res.status(200).json({
      message: 'Employee restored successfully',
      employee,
    });
  } catch (error) {
    next(error);
  }
};
// EXPORT EMPLOYEES TO CSV
exports.exportEmployeesCSV = async (req, res, next) => {
  try {
    const query = {
      createdBy: req.userId,
      deletedAt: null,
    };

    const employees = await Employee.find(query).sort({ createdAt: -1 });

    const header = [
      "Name",
      "Role",
      "Email",
      "Status",
      "Monthly Salary",
      "Overtime Rate",
      "Date of Birth",
      "Joining Date",
      "Department",
    ];

    const escapeCsvField = (value) => {
      if (value === undefined || value === null) return "";
      let str = String(value);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
    };

    const rows = employees.map((emp) => [
      escapeCsvField(emp.fullName || ""),
      escapeCsvField(emp.role || ""),
      escapeCsvField(emp.email || ""),
      escapeCsvField(emp.isActive ? "Active" : "Inactive"),
      emp.monthlySalary || 0,
      emp.overtimeRate || 0,
      escapeCsvField(formatDate(emp.dateOfBirth)),
      escapeCsvField(formatDate(emp.joiningDate)),
      escapeCsvField(emp.department || ""),
    ]);

    const csvContent = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=employees_${new Date().toISOString().split("T")[0]}.csv`
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};