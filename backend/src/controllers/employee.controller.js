const Employee = require("../models/employee.model");
const User = require("../models/user.model");
const { parse } = require("csv-parse");
const { isNonEmptyString } = require("../utils/validators");
const PayrollUpdate = require("../models/payroll.model");
// ADD EMPLOYEE
exports.addEmployee = async (req, res) => {
  try {
    const { fullName, role, monthlySalary, overtimeRate } = req.body;

    if (!isNonEmptyString(fullName) || !isNonEmptyString(role)) {
      return res.status(400).json({ message: "Full name and role are required non-empty strings" });
    }

    const numSalary = Number(monthlySalary);
    if (monthlySalary === undefined || monthlySalary === null || isNaN(numSalary) || !Number.isFinite(numSalary) || numSalary <= 0) {
      return res.status(400).json({ message: "Monthly salary must be a positive number" });
    }

    let numOvertime = 0;
    if (overtimeRate !== undefined && overtimeRate !== null) {
      numOvertime = Number(overtimeRate);
      if (isNaN(numOvertime) || !Number.isFinite(numOvertime) || numOvertime < 0) {
        return res.status(400).json({ message: "Overtime rate must be a non-negative number" });
      }
    }

    // Get the user's company name
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const employee = new Employee({
      fullName: fullName.trim(),
      role: role.trim(),
      monthlySalary: numSalary,
      overtimeRate: numOvertime,
      companyName: user.companyName,
      createdBy: req.userId,
    });

    await employee.save();

    res.status(201).json({ message: "Employee added successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET ALL EMPLOYEES (for the logged-in user's company)
exports.getEmployees = async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 10;

    let search = req.query.search;
    if (typeof search !== "string") search = "";
    search = search.trim();

    // Escape regex special characters to prevent ReDoS attacks (#121)
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const skip = (page - 1) * limit;

    const query = {
      createdBy: req.userId,
    };

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { fullName: { $regex: safeSearch, $options: "i" } },
        { role: { $regex: safeSearch, $options: "i" } },
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
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET RECENTLY ADDED EMPLOYEES (last 5)
exports.getRecentEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ createdBy: req.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({ employees });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No CSV file uploaded",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const csvData = req.file.buffer.toString("utf-8");

    parse(
      csvData,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      },
      async (err, records) => {
        try {
          if (err) {
            return res.status(400).json({
              message: "Invalid CSV format",
            });
          }

          // Fetch existing employees to detect duplicates by fullName + role
          const existingEmployees = await Employee.find({ createdBy: req.userId });
          const existingKeys = new Set(
            existingEmployees.map(e => `${e.fullName.toLowerCase()}|${e.role.toLowerCase()}`)
          );

          const employees = [];
          const errors = [];
          let skipped = 0;

          records.forEach((record, index) => {
            const fullName = record.fullName?.trim();
            const role = record.role?.trim();
            const monthlySalary = Number(record.monthlySalary);
            const overtimeRate = Number(record.overtimeRate || 0);

            if (!fullName) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Full name is required",
              });
              return;
            }

            if (!role) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Role is required",
              });
              return;
            }

            if (isNaN(monthlySalary) || monthlySalary <= 0) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Invalid monthly salary",
              });
              return;
            }

            if (isNaN(overtimeRate) || overtimeRate < 0) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Invalid overtime rate",
              });
              return;
            }

            // Check for duplicate by fullName + role (case-insensitive)
            const key = `${fullName.toLowerCase()}|${role.toLowerCase()}`;
            if (existingKeys.has(key)) {
              skipped++;
              errors.push({
                row: index + 2,
                reason: "Duplicate employee (same name and role already exists)",
              });
              return;
            }

            // Also prevent duplicates within the same CSV batch
            existingKeys.add(key);

            employees.push({
              fullName,
              role,
              monthlySalary,
              overtimeRate,
              companyName: user.companyName,
              createdBy: req.userId,
            });
          });

          if (employees.length > 0) {
            await Employee.insertMany(employees);
          }

          return res.status(200).json({
            message: "Employee import completed",
            imported: employees.length,
            skipped,
            errors,
          });
        } catch (dbError) {
          return res.status(500).json({
            message: "Server error during employee import",
            error: dbError.message,
          });
        }
      }
    );
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// UPDATE EMPLOYEE
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, monthlySalary, overtimeRate } = req.body;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Ensure the logged-in user is the creator of this employee
    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized to update this employee" });
    }

    // Validate fields if provided
    if (monthlySalary !== undefined && (isNaN(monthlySalary) || monthlySalary <= 0)) {
      return res.status(400).json({ message: "Monthly salary must be a positive number" });
    }

    if (overtimeRate !== undefined && (isNaN(overtimeRate) || overtimeRate < 0)) {
      return res.status(400).json({ message: "Overtime rate must be a non-negative number" });
    }

    // Apply updates only for provided fields
    if (fullName !== undefined) employee.fullName = fullName;
    if (role !== undefined) employee.role = role;
    if (monthlySalary !== undefined) employee.monthlySalary = monthlySalary;
    if (overtimeRate !== undefined) employee.overtimeRate = overtimeRate;

    await employee.save();

    res.status(200).json({ message: "Employee updated successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// DELETE EMPLOYEE
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // Check ownership
    if (employee.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        message: "Not authorized to delete this employee",
      });
    }

    // Check if employee has historical "paid" payroll records (#345)
    const hasPaidPayroll = await PayrollUpdate.exists({
      employeeId: id,
      createdBy: req.userId,
      status: "paid",
    });

    if (hasPaidPayroll) {
      return res.status(400).json({
        message: "Cannot delete employee with historical paid payroll records",
      });
    }

    // Delete related payroll records
    await PayrollUpdate.deleteMany({
      employeeId: id,
      createdBy: req.userId,
    });

    // Delete employee
    await Employee.findByIdAndDelete(id);

    res.status(200).json({
      message: "Employee and payroll records deleted successfully",
    });

  } catch (error) {
    console.error("Delete employee error:", error);

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};