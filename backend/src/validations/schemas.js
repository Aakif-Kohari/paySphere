const { z } = require('zod');

const optionalNullableString = (message = 'Expected a string') =>
  z.string({ message }).trim().optional().nullable();

const dateString = (label) =>
  z
    .string({ message: `${label} must be a valid date` })
    .trim()
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      `${label} must be a valid date`,
    );

// User validation schemas. These are intentionally strict so unknown request
// fields cannot silently pass through the API boundary.
const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(100),
    email: z.string().trim().email('Invalid email format').max(254),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/\d/, 'Password must contain at least one number')
      .regex(
        /[^A-Za-z0-9]/,
        'Password must contain at least one special character',
      ),
    companyName: z
      .string()
      .trim()
      .min(2, 'Company name must be at least 2 characters')
      .max(100),
    recaptchaToken: z.string().trim().nullable().optional(),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email format').max(254),
    password: z.string().min(1, 'Password is required').max(128),
    recaptchaToken: z.string().trim().nullable().optional(),
  })
  .strict();

const bankDetailsSchema = z
  .object({
    bankName: z.string().trim().max(100).optional().nullable(),
    accountNumber: z.string().trim().max(30).optional().nullable(),
    routingCode: z.string().trim().max(20).optional().nullable(),
  })
  .strict();

// Employee validation mirrors the fields accepted by the create controller and
// rejects unknown fields instead of silently stripping them.
const employeeSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(100),
    role: z.string().trim().min(1, 'Role is required').max(100),
    department: z.string().trim().max(100).optional().nullable(),
    monthlySalary: z
      .number()
      .finite()
      .positive('Salary must be positive')
      .max(100000000),
    overtimeRate: z
      .number()
      .finite()
      .min(0, 'Overtime rate cannot be negative')
      .max(1000000)
      .optional()
      .nullable(),
    dateOfBirth: dateString('Date of birth').optional().nullable(),
    joiningDate: dateString('Joining date').optional().nullable(),
    email: z
      .string()
      .trim()
      .email('Invalid email address format')
      .max(100)
      .optional()
      .nullable(),
    phone: z.string().trim().min(7).max(30).optional().nullable(),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
    language: z
      .enum(['en', 'es', 'hi', 'English', 'English (US)', 'Spanish', 'Hindi'])
      .optional(),
    bankDetails: bankDetailsSchema.optional().nullable(),
  })
  .strict();

const payrollFinalizeSchema = z
  .object({
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    activities: z
      .array(
        z
          .object({
            name: z.string().min(1, 'Employee name cannot be empty'),
            tags: z.array(z.object({ label: z.string() }).strict()),
          })
          .strict(),
      )
      .min(1, 'At least one activity is required'),
  })
  .strict();

// Onboarding validation schemas
const ONBOARDING_DEPARTMENTS = ['HR', 'IT', 'Finance', 'Manager', 'Employee'];
const ONBOARDING_TASK_STATUSES = [
  'Pending',
  'In Progress',
  'Completed',
  'Blocked',
];
const ONBOARDING_DOC_STATUSES = [
  'Pending Verification',
  'Verified',
  'Rejected',
];

const onboardingTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().max(500).optional().nullable(),
    department: z.enum(ONBOARDING_DEPARTMENTS),
    dueOffsetDays: z.number().int().min(-30).max(365),
    isMandatory: z.boolean().optional(),
  })
  .strict();

const createOnboardingPlanSchema = z
  .object({
    name: z.string().trim().min(1, 'Plan name is required').max(100),
    description: z.string().max(500).optional().nullable(),
    tasks: z.array(onboardingTaskSchema).optional().nullable(),
  })
  .strict();

const startOnboardingSchema = z
  .object({
    planId: z.string().trim().min(1),
    employeeId: z.string().trim().min(1),
    joiningDate: dateString('Joining date'),
  })
  .strict();

module.exports = {
  signupSchema,
  loginSchema,
  employeeSchema,
  payrollFinalizeSchema,
  createOnboardingPlanSchema,
  startOnboardingSchema,
  ONBOARDING_DEPARTMENTS,
  ONBOARDING_TASK_STATUSES,
  ONBOARDING_DOC_STATUSES,
};
