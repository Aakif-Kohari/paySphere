const mongoose = require('mongoose');

/**
 * SalaryHistory Schema
 * 
 * Tracks all changes to an employee's monthly salary for audit purposes.
 * This provides a simple audit trail separate from the more complex
 * SalaryStructure system, capturing when and by whom salary was modified.
 * 
 * Issue: #505
 */
const salaryHistorySchema = new mongoose.Schema(
    {
        // Reference to the employee whose salary was changed
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
            index: true,
        },

        // The employee's name at the time of the change (denormalized for historical accuracy)
        employeeName: {
            type: String,
            required: true,
            maxlength: [100, 'Employee name cannot exceed 100 characters'],
        },

        // The salary value before this change
        previousSalary: {
            type: Number,
            required: true,
            min: [0, 'Previous salary cannot be negative'],
        },

        // The new salary value after this change
        newSalary: {
            type: Number,
            required: true,
            min: [1, 'New salary must be positive'],
        },

        // The calculated difference (new - old) for quick reference
        salaryChange: {
            type: Number,
            required: true,
        },

        // Percentage change for reporting
        percentageChange: {
            type: Number,
            required: true,
        },

        // Reference to the user who made the change
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Name of the user who made the change (denormalized)
        changedByName: {
            type: String,
            required: true,
            maxlength: [100, 'Changed by name cannot exceed 100 characters'],
        },

        // Optional reason for the salary change
        reason: {
            type: String,
            enum: [
                'promotion',
                'annual_revision',
                'performance_review',
                'market_adjustment',
                'role_change',
                'correction',
                'initial',
                'other',
            ],
            default: 'other',
        },

        // Optional note or comment about the change
        note: {
            type: String,
            default: '',
            maxlength: [500, 'Note cannot exceed 500 characters'],
        },

        // Tenant ID for multi-tenancy support
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true,
        },

        // Currency at the time of change
        currency: {
            type: String,
            default: 'INR',
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
    }
);

/**
 * Compound Index for Efficient Queries
 * 
 * Optimizes queries that fetch salary history for a specific employee
 * sorted by most recent changes first.
 */
salaryHistorySchema.index(
    { employeeId: 1, createdAt: -1 },
    { name: 'idx_employee_history' }
);

/**
 * Index for Tenant-scoped Queries
 * 
 * Ensures efficient filtering by tenant for multi-tenant deployments.
 */
salaryHistorySchema.index(
    { tenantId: 1, employeeId: 1, createdAt: -1 },
    { name: 'idx_tenant_employee_history' }
);

/**
 * Index for User Queries
 * 
 * Optimizes queries to find all salary changes made by a specific user.
 */
salaryHistorySchema.index(
    { changedBy: 1, createdAt: -1 },
    { name: 'idx_changed_by_history' }
);

/**
 * Index for Date Range Queries
 * 
 * Supports efficient filtering by date ranges for reporting.
 */
salaryHistorySchema.index(
    { createdAt: -1 },
    { name: 'idx_created_at' }
);

/**
 * Pre-save Hook
 * 
 * Automatically calculates salary change and percentage change
 * before saving the document.
 */
salaryHistorySchema.pre('save', function (next) {
    // Calculate the absolute change in salary
    this.salaryChange = this.newSalary - this.previousSalary;

    // Calculate percentage change (avoid division by zero)
    if (this.previousSalary > 0) {
        this.percentageChange =
            Math.round(((this.newSalary - this.previousSalary) / this.previousSalary) * 10000) / 100;
    } else {
        this.percentageChange = 100; // 100% increase from 0
    }

    next();
});

/**
 * Virtual: Formatted Salary Change
 * 
 * Returns a human-readable string with the salary change amount and percentage.
 */
salaryHistorySchema.virtual('formattedChange').get(function () {
    const sign = this.salaryChange >= 0 ? '+' : '';
    const percentSign = this.percentageChange >= 0 ? '+' : '';
    return `${sign}${this.salaryChange} (${percentSign}${this.percentageChange}%)`;
});

/**
 * Ensure virtuals are included in JSON output
 */
salaryHistorySchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        // Remove internal fields from JSON output
        delete ret.__v;
        return ret;
    },
});

/**
 * Static Method: Get History for Employee
 * 
 * Retrieves salary history for a specific employee with pagination.
 * 
 * @param {string} employeeId - The employee's ID
 * @param {string} tenantId - The tenant ID for scoping
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Number of records per page
 * @returns {Promise<Object>} Paginated salary history
 */
salaryHistorySchema.statics.getHistoryForEmployee = async function (
    employeeId,
    tenantId,
    page = 1,
    limit = 20
) {
    const skip = (page - 1) * limit;

    const [history, totalCount] = await Promise.all([
        this.find({
            employeeId,
            tenantId,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('changedBy', 'fullName email')
            .lean(),
        this.countDocuments({
            employeeId,
            tenantId,
        }),
    ]);

    return {
        history,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalRecords: totalCount,
            recordsPerPage: limit,
        },
    };
};

/**
 * Static Method: Create History Entry
 * 
 * Creates a new salary history entry with validation.
 * 
 * @param {Object} params - History parameters
 * @param {string} params.employeeId - Employee ID
 * @param {string} params.employeeName - Employee name
 * @param {number} params.previousSalary - Previous salary
 * @param {number} params.newSalary - New salary
 * @param {string} params.changedBy - User ID who made the change
 * @param {string} params.changedByName - User name who made the change
 * @param {string} params.tenantId - Tenant ID
 * @param {string} [params.reason] - Reason for change
 * @param {string} [params.note] - Additional note
 * @param {string} [params.currency] - Currency code
 * @returns {Promise<Object>} Created history entry
 */
salaryHistorySchema.statics.createHistory = async function (params) {
    const {
        employeeId,
        employeeName,
        previousSalary,
        newSalary,
        changedBy,
        changedByName,
        tenantId,
        reason = 'other',
        note = '',
        currency = 'INR',
    } = params;

    // Validate required fields
    if (!employeeId || !previousSalary || !newSalary || !changedBy || !tenantId) {
        throw new Error('Missing required fields for salary history');
    }

    // Create and save the history entry
    const history = await this.create({
        employeeId,
        employeeName,
        previousSalary,
        newSalary,
        changedBy,
        changedByName,
        tenantId,
        reason,
        note,
        currency,
    });

    return history;
};

module.exports = mongoose.model('SalaryHistory', salaryHistorySchema);
