const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const User = require("../models/user.model");

// GET EMPLOYEE PROFILE (Self-service)
exports.getEmployeeProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    let employee = null;
    if (user.employeeId) {
      employee = await Employee.findById(user.employeeId);
    } else {
      // Fallback matching by email if employeeId is not linked directly
      employee = await Employee.findOne({ email: user.email });
    }

    res.status(200).json({
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role || "EMPLOYEE",
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
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let employeeId = user.employeeId;
    if (!employeeId) {
      const emp = await Employee.findOne({ email: user.email });
      if (emp) employeeId = emp._id;
    }

    if (!employeeId) {
      return res.status(200).json({ payrolls: [] });
    }

    const payrolls = await PayrollUpdate.find({ employeeId }).sort({ year: -1, month: -1 });

    res.status(200).json({ payrolls });
  } catch (error) {
    next(error);
  }
};
