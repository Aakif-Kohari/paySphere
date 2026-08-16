const mongoose = require('mongoose');

// Simple Payroll Mongoose Schema
const PayrollSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  baseSalary: { type: Number, required: true },
  overtimeHours: { type: Number, default: 0 },
  overtimeRate: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, required: true },
});

const Payroll = mongoose.models.Payroll || mongoose.model('Payroll', PayrollSchema);

exports.calculatePayroll = async (req, res) => {
  try {
    const { month, year, baseSalary, overtimeHours = 0, overtimeRate = 0, bonus = 0, deductions = 0 } = req.body;
    
    if (!month || !year || !baseSalary) {
      return res.status(400).json({ success: false, message: 'Month, year, and baseSalary are required' });
    }

    // Perform basic calculation: baseSalary + (overtimeHours * overtimeRate) + bonus - deductions
    const overtimePay = overtimeHours * overtimeRate;
    const netSalary = baseSalary + overtimePay + bonus - deductions;

    const payroll = new Payroll({
      userId: req.user.userId,
      month,
      year,
      baseSalary,
      overtimeHours,
      overtimeRate,
      bonus,
      deductions,
      netSalary
    });
    await payroll.save();

    res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPayrollHistory = async (req, res) => {
  try {
    const payrolls = await Payroll.find({ userId: req.user.userId });
    res.status(200).json({ success: true, data: payrolls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
