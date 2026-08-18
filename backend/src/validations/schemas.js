const { z } = require("zod");

// User validation schemas
const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Employee validation schemas
const employeeSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  role: z.string().optional(),
  monthlySalary: z.number().positive("Salary must be positive"),
  overtimeRate: z.number().min(0).optional(),
});

// Payroll validation schemas
const payrollFinalizeSchema = z.object({
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2000).max(2100).optional(),
  activities: z.array(
    z.object({
      name: z.string().min(1, "Employee name cannot be empty"),
      tags: z.array(
        z.object({
          label: z.string(),
        })
      ),
    })
  ).min(1, "At least one activity is required"),
});

module.exports = {
  signupSchema,
  loginSchema,
  employeeSchema,
  payrollFinalizeSchema,
};
