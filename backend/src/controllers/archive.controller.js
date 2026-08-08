const Employee = require('../models/employee.model');

// Fetch all archived employees for the tenant
exports.getArchivedEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find({
      createdBy: req.userId,
      isDeleted: true,
    })
      .setOptions({ includeDeleted: true })
      .sort({ deletedAt: -1 });
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
};
