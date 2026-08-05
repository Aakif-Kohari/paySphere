const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");
const { parse } = require("csv-parse");
const { isNonEmptyString, isValidEmail, isValidPhone, escapeRegex, sanitizeText, MONTHLY_SALARY_MAX, OVERTIME_RATE_MAX, FULLNAME_MAX_LENGTH, ROLE_MAX_LENGTH } = require("../utils/validators");
const PayrollUpdate = require("../models/payroll.model");
const logger = require("../utils/logger");
const eventBus = require("../services/event.service");
const cacheService = require("../services/cache.service");
const Settlement = require("../models/settlement.model");

/**
 * Does this record belong to the caller's company?
 *
 * Replaces four copies of
 *
 *     if (employee.createdBy.toString() !== req.userId) { ... 403 }
 *
 * which had two problems. It compared the *creator*, so a second admin at the
 * same company could not edit an employee their colleague had added — the
 * record is the company's, not one person's. And after #585 stopped writing
 * `createdBy`, `employee.createdBy` was undefined on every record written since,
 * so the guard threw `TypeError: Cannot read properties of undefined (reading
 * 'toString')` and turned a 403 into a 500 (#613).
 *
 * Compared as strings because one side is an ObjectId off a document and the
 * other is whatever `auth.middleware` resolved — which may be either.
 *
 * @param {object} record any document carrying `tenantId`
 * @param {object} req the authenticated request
 * @returns {boolean}
 */
function belongsToCaller(record, req) {
  if (!record?.tenantId || !req?.tenantId) return false;

  return String(record.tenantId) === String(req.tenantId);
}

/**
 * Normalize an employee email for storage.
 *
 * Returns `undefined` for a blank/absent address rather than `""`, so the
 * partial unique index on { email, tenantId } skips the document entirely.
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
 * Normalize an employee phone number for storage (#8).
 *
 * Mirrors normalizeEmployeeEmail: blank/absent means "not provided" (or
 * "clear it" on update), so we return undefined rather than an empty
 * string. Only validates format when a non-empty value is actually given,
 * since phone is optional on creation.
 *
 * @param {*} value raw value from the request body
 * @returns {{ ok: true, value: string|undefined } | { ok: false }}
 */
function normalizeEmployeePhone(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return { ok: true, value: undefined };
  }
  if (!isValidPhone(value)) return { ok: false };

  const normalized = value.trim().replace(/[()\s-]/g, "");
  return { ok: true, value: normalized };
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
const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
exports.addEmployee = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }

    const { fullName, role, department, monthlySalary, overtimeRate, dateOfBirth, joiningDate, email, phone, bankDetails } = req.body;

    if (email && typeof email === 'string' && email.trim() !== '') {
      if (!regex.test(email.trim())) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }
    }

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

    const normalizedEmail = normalizeEmployeeEmail(email);
    if (!normalizedEmail.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid email address format' });
    }

    const normalizedPhone = normalizeEmployeePhone(phone);
    if (!normalizedPhone.ok) {
      return res
        .status(400)
        .json({ message: 'Phone number must be a valid international phone number' });
    }

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
      tenantId: req.tenantId,
      ...(normalizedEmail.value ? { email: normalizedEmail.value } : {}),
      ...(normalizedPhone.value ? { phone: normalizedPhone.value } : {}),
    });

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
      tenantId: req.tenantId,
    };

    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
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
    const employees = await Employee.find({ 
      tenantId: req.tenantId, 
      deletedAt: null,
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({ employees });
  } catch (error) {
    next(error);
  }
};

exports.importEmployees = async (req, res, next) => {
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

          const csvNames = Array.from(
            new Set(records.map((r) => r.fullName?.trim()).filter(Boolean)),
          );

          const nameRegexes = csvNames.map(
            (name) =>
              new RegExp(
                '^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
                'i',
              ),
          );

          const existingEmployees =
            nameRegexes.length > 0
              ? await Employee.find({
                tenantId: req.tenantId,
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

            const normalizedEmail = normalizeEmployeeEmail(record.email);
            if (!normalizedEmail.ok) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Invalid email format: "${record.email}"`,
              });
              return;
            }

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

            const normalizedPhone = normalizeEmployeePhone(record.phone);
            if (!normalizedPhone.ok) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: `Invalid phone number format: "${record.phone}"`,
              });
              return;
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

            const sanitizedDepartment = record.department ? sanitizeText(record.department.trim()) : '';

            employees.push({
              fullName: sanitizedName,
              role: sanitizedRole,
              department: sanitizedDepartment,
              monthlySalary,
              overtimeRate,
              companyName: sanitizeText(user.companyName),
              createdBy: req.userId,
              tenantId: req.tenantId,
              ...(normalizedEmail.value ? { email: normalizedEmail.value } : {}),
              ...(normalizedPhone.value ? { phone: normalizedPhone.value } : {}),
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
    const { fullName, role, department, monthlySalary, overtimeRate, isActive, email, phone, bankDetails } = req.body;

    const employee = await Employee.findById(id);

    if (!employee || employee.deletedAt || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (!belongsToCaller(employee, req)) {
      return res
        .status(403)
        .json({ message: 'Not authorized to update this employee' });
    }

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

    const normalizedEmail = normalizeEmployeeEmail(email);
    if (!normalizedEmail.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid email address format' });
    }

    const normalizedPhone = normalizeEmployeePhone(phone);
    if (!normalizedPhone.ok) {
      return res
        .status(400)
        .json({ message: 'Phone number must be a valid international phone number' });
    }

    const oldSalary = employee.monthlySalary;
    const oldName = employee.fullName;
    const salaryChanged = monthlySalary !== undefined && Number(monthlySalary) !== oldSalary;

    if (fullName !== undefined) employee.fullName = sanitizeText(fullName);
    if (role !== undefined) employee.role = sanitizeText(role);
    if (department !== undefined) employee.department = sanitizeText(department);
    if (monthlySalary !== undefined) employee.monthlySalary = monthlySalary;
    if (overtimeRate !== undefined) employee.overtimeRate = overtimeRate;
    if (isActive !== undefined) employee.isActive = isActive;
    if (req.body.dateOfBirth !== undefined) employee.dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined;
    if (req.body.joiningDate !== undefined) employee.joiningDate = req.body.joiningDate ? new Date(req.body.joiningDate) : undefined;

    if (email !== undefined) {
      if (normalizedEmail.value) {
        employee.email = normalizedEmail.value;
      } else {
        employee.email = undefined;
        employee.markModified('email');
      }
    }

    if (phone !== undefined) {
      if (normalizedPhone.value) {
        employee.phone = normalizedPhone.value;
      } else {
        employee.phone = undefined;
        employee.markModified('phone');
      }
    }

    if (bankDetails && typeof bankDetails === 'object') {
      employee.bankDetails = {
        bankName: sanitizeText(bankDetails.bankName ?? employee.bankDetails?.bankName ?? ''),
        accountNumber: sanitizeText(bankDetails.accountNumber ?? employee.bankDetails?.accountNumber ?? ''),
        routingCode: sanitizeText(bankDetails.routingCode ?? employee.bankDetails?.routingCode ?? ''),
      };
    }

    await employee.save();

    if (salaryChanged) {
      try {
        const SalaryHistory = require('../models/salaryHistory.model');
        const User = require('../models/user.model');
        const user = await User.findById(req.userId);
        
        await SalaryHistory.createHistory({
          employeeId: employee._id,
          employeeName: employee.fullName,
          previousSalary: oldSalary,
          newSalary: employee.monthlySalary,
          changedBy: req.userId,
          changedByName: user?.fullName || user?.email || 'Unknown',
          tenantId: req.tenantId,
          reason: req.body.salaryChangeReason || 'other',
          note: req.body.salaryChangeNote || '',
          currency: employee.currency || 'INR',
        });
        
        logger.info('Salary history created', {
          userId: req.userId,
          employeeId: id,
          oldSalary,
          newSalary: employee.monthlySalary,
        });
      } catch (historyError) {
        logger.error('Failed to create salary history', {
          userId: req.userId,
          employeeId: id,
          error: historyError.message,
        });
      }
    }

    if (fullName !== undefined && employee.fullName !== oldName) {
      try {
        const result = await PayrollUpdate.updateMany(
          { employeeId: id, tenantId: req.tenantId, status: 'finalized' },
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
        salaryChanged,
        oldSalary: salaryChanged ? oldSalary : undefined,
        newSalary: salaryChanged ? employee.monthlySalary : undefined,
        changes: Object.keys(req.body).filter((k) => k !== 'id' && !k.startsWith('salaryChange')),
      },
      req,
    });

    logger.info(`Employee updated`, {
      userId: req.userId,
      employeeId: employee._id,
      fullName: employee.fullName,
      salaryChanged,
    });

    await cacheService.invalidateAnalytics(req.userId);
    res.status(200).json({ 
      message: "Employee updated successfully", 
      employee,
      salaryChanged,
      oldSalary: salaryChanged ? oldSalary : undefined,
      newSalary: salaryChanged ? employee.monthlySalary : undefined,
    });
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

    if (!employee || employee.deletedAt || employee.isDeleted) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (!belongsToCaller(employee, req)) {
      return res
        .status(403)
        .json({ message: 'Not authorized to update this employee' });
    }

    employee.isActive = !employee.isActive;
    await employee.save();

    await cacheService.invalidateAnalytics(req.userId);

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

    if (!belongsToCaller(employee, req)) {
      return res.status(403).json({
        message: 'Not authorized to delete this employee',
      });
    }

    const hasPaidPayroll = await PayrollUpdate.exists({
      employeeId: id,
      tenantId: req.tenantId,
      status: 'paid',
    });

    if (hasPaidPayroll) {
      return res.status(400).json({
        message: 'Cannot delete employee with historical paid payroll records',
      });
    }

    const hasSettlement = await Settlement.exists({
      employeeId: id,
      tenantId: req.tenantId,
    });

    if (hasSettlement) {
      return res.status(400).json({
        message: 'Cannot delete employee with existing settlement records',
      });
    }

    employee.isDeleted = true;
    employee.deletedAt = new Date();
    await employee.save();

    await cacheService.invalidateAnalytics(req.userId);

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: 'EMPLOYEE_DELETE',
      resourceType: 'Employee',
      resourceIds: [employee._id],
      details: {
        fullName: employee.fullName,
      },
      req,
    });

    logger.info(`Employee deleted`, {
      userId: req.userId,
      employeeId: employee._id,
    });

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    next(error);
  }
};