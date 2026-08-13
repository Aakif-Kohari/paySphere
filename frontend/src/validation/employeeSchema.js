/**
 * @fileoverview Employee Validation Schema
 * @description Strict Yup validation schema for the Add/Edit Employee forms.
 * Enforces data types, length limits, and format rules matching the backend Mongoose models.
 * 
 * Issue: #733
 */
import * as Yup from 'yup';

// Regex patterns matching backend validators
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ACCOUNT_NUMBER_REGEX = /^[a-zA-Z0-9]{4,30}$/;
const ROUTING_CODE_REGEX = /^[a-zA-Z0-9]{4,20}$/;

export const employeeValidationSchema = Yup.object().shape({
    fullName: Yup.string()
        .trim()
        .required('Full name is required')
        .max(100, 'Full name cannot exceed 100 characters')
        .matches(/^[a-zA-Z\s.'-]+$/, 'Full name contains invalid characters'),

    email: Yup.string()
        .trim()
        .nullable()
        .transform((curr, orig) => (orig === '' ? null : curr))
        .matches(EMAIL_REGEX, 'Invalid email address format')
        .max(100, 'Email cannot exceed 100 characters'),

    role: Yup.string()
        .trim()
        .required('Role / Designation is required')
        .max(100, 'Role cannot exceed 100 characters'),

    department: Yup.string()
        .trim()
        .nullable()
        .max(100, 'Department cannot exceed 100 characters'),

    monthlySalary: Yup.number()
        .typeError('Monthly salary must be a number')
        .required('Monthly salary is required')
        .positive('Monthly salary must be positive')
        .max(100000000, 'Salary exceeds maximum allowed limit')
        .test('decimals', 'Maximum 2 decimal places allowed', (val) => {
            if (!val && val !== 0) return true;
            const parts = val.toString().split('.');
            return !parts[1] || parts[1].length <= 2;
        }),

    overtimeRate: Yup.number()
        .typeError('Overtime rate must be a number')
        .nullable()
        .min(0, 'Overtime rate cannot be negative')
        .max(100000, 'Overtime rate exceeds maximum limit'),

    dateOfBirth: Yup.date()
        .nullable()
        .max(new Date(), 'Date of birth cannot be in the future')
        .min(new Date('1900-01-01'), 'Invalid date of birth'),

    joiningDate: Yup.date()
        .nullable()
        .max(new Date(), 'Joining date cannot be in the future'),

    currency: Yup.string()
        .required('Currency is required')
        .oneOf(['INR', 'USD', 'EUR', 'GBP'], 'Unsupported currency'),

    bankDetails: Yup.object().shape({
        bankName: Yup.string()
            .trim()
            .nullable()
            .max(100, 'Bank name cannot exceed 100 characters'),
        accountNumber: Yup.string()
            .trim()
            .nullable()
            .matches(ACCOUNT_NUMBER_REGEX, 'Invalid account number format (4-30 alphanumeric chars)')
            .max(30, 'Account number cannot exceed 30 characters'),
        routingCode: Yup.string()
            .trim()
            .nullable()
            .matches(ROUTING_CODE_REGEX, 'Invalid routing/IFSC code format')
            .max(20, 'Routing code cannot exceed 20 characters'),
    }),
});

/**
 * Initial values for the Formik form
 */
export const initialEmployeeValues = {
    fullName: '',
    email: '',
    role: '',
    department: '',
    monthlySalary: '',
    overtimeRate: '',
    dateOfBirth: '',
    joiningDate: '',
    currency: 'INR',
    bankDetails: {
        bankName: '',
        accountNumber: '',
        routingCode: '',
    },
};
