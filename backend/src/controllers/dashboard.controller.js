/**
 * @fileoverview Dashboard Controller
 * @description Handles complex aggregations for the main dashboard summary.
 * Implements Redis caching with a 15-minute TTL to optimize performance and
 * reduce database load from frequent page refreshes.
 * 
 * Issue: #519
 */

const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const Attendance = require('../models/attendance.model');
const Loan = require('../models/loan.model');
const logger = require('../utils/logger');
const cacheService = require('../services/cache.service');
const { PAYROLL_STATUS } = require('../config/payrollStatus');

/**
 * Cache configuration constants
 * @constant {number} DASHBOARD_CACHE_TTL - Time to live in seconds (15 minutes)
 */
const DASHBOARD_CACHE_TTL = 900; // 15 minutes * 60 seconds

/**
 * Helper function to generate the cache key for a specific user's dashboard
 * @param {string} userId - The authenticated user's ID
 * @returns {string} The formatted cache key
 */
const getDashboardCacheKey = (userId) => `dashboard:summary:${userId}`;

/**
 * GET /api/dashboard/summary
 * 
 * Retrieves a comprehensive summary of dashboard metrics including:
 * - Total and active employee counts
 * - Current month payroll totals (pending, approved, paid)
 * - Pending approval counts and values
 * - Active loan portfolio summary
 * - Recent activity feed
 * 
 * The response is cached in Redis for 15 minutes to optimize performance.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getDashboardSummary = async (req, res, next) => {
    try {
        const userId = req.userId;
        const tenantId = req.tenantId;
        const cacheKey = getDashboardCacheKey(userId);

        // 1. Attempt to retrieve cached data first
        const cachedData = await cacheService.get(cacheKey);
        if (cachedData) {
            logger.debug('Dashboard summary served from cache', { userId });
            return res.status(200).json({
                ...cachedData,
                _cached: true,
                _cacheTTL: DASHBOARD_CACHE_TTL
            });
        }

        // 2. Cache miss - perform complex database aggregations
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Calculate the start and end of the current month for precise filtering
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        // Execute multiple aggregations in parallel to minimize total query time
        const [
            employeeStats,
            payrollStats,
            pendingApprovals,
            loanStats,
            attendanceStats
        ] = await Promise.all([
            // Employee Statistics
            Employee.aggregate([
                { $match: { tenantId, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        totalEmployees: { $sum: 1 },
                        activeEmployees: { $sum: { $cond: ['$isActive', 1, 0] } },
                        totalMonthlySalary: { $sum: '$monthlySalary' },
                        departments: { $addToSet: '$department' }
                    }
                }
            ]),

            // Current Month Payroll Statistics
            PayrollUpdate.aggregate([
                {
                    $match: {
                        tenantId,
                        month: currentMonth,
                        year: currentYear
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPayroll: {
                            $sum: {
                                $cond: [
                                    { $in: ['$status', [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID]] },
                                    '$netSalary',
                                    0
                                ]
                            }
                        },
                        pendingCount: {
                            $sum: { $cond: [{ $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] }, 1, 0] }
                        },
                        pendingAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                                    '$netSalary',
                                    0
                                ]
                            }
                        },
                        approvedCount: {
                            $sum: { $cond: [{ $eq: ['$status', PAYROLL_STATUS.APPROVED] }, 1, 0] }
                        },
                        paidCount: {
                            $sum: { $cond: [{ $eq: ['$status', PAYROLL_STATUS.PAID] }, 1, 0] }
                        }
                    }
                }
            ]),

            // Pending Approvals Detail (for notification badges)
            PayrollUpdate.countDocuments({
                tenantId,
                status: PAYROLL_STATUS.PENDING_APPROVAL
            }),

            // Active Loan Portfolio
            Loan.aggregate([
                { $match: { tenantId, status: 'active' } },
                {
                    $group: {
                        _id: null,
                        totalOutstanding: { $sum: '$outstanding' },
                        activeLoans: { $sum: 1 },
                        totalDisbursed: { $sum: '$principalAmount' }
                    }
                }
            ]),

            // Current Month Attendance Overview
            Attendance.aggregate([
                {
                    $match: {
                        tenantId,
                        month: currentMonth,
                        year: currentYear
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRecords: { $sum: 1 },
                        averagePresentDays: { $avg: '$totals.presentDays' },
                        averageLeaveDays: { $avg: '$totals.leaveDays' }
                    }
                }
            ])
        ]);

        // 3. Fetch recent activity feed (last 5 payroll or employee events)
        const recentPayrolls = await PayrollUpdate.find({ tenantId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('employeeName status month year netSalary updatedAt')
            .lean();

        // 4. Structure the response payload
        const empStats = employeeStats[0] || {};
        const payStats = payrollStats[0] || {};
        const lnStats = loanStats[0] || {};
        const attStats = attendanceStats[0] || {};

        const summaryData = {
            employees: {
                total: empStats.totalEmployees || 0,
                active: empStats.activeEmployees || 0,
                totalMonthlySalary: empStats.totalMonthlySalary || 0,
                uniqueDepartments: (empStats.departments || []).filter(d => d && d.trim() !== '').length
            },
            payroll: {
                currentMonth,
                currentYear,
                totalPayout: payStats.totalPayroll || 0,
                pendingApprovals: {
                    count: payStats.pendingCount || 0,
                    amount: payStats.pendingAmount || 0
                },
                approved: payStats.approvedCount || 0,
                paid: payStats.paidCount || 0
            },
            loans: {
                activeCount: lnStats.activeLoans || 0,
                totalOutstanding: lnStats.totalOutstanding || 0,
                totalDisbursed: lnStats.totalDisbursed || 0
            },
            attendance: {
                recordsLogged: attStats.totalRecords || 0,
                avgPresentDays: Math.round((attStats.averagePresentDays || 0) * 10) / 10,
                avgLeaveDays: Math.round((attStats.averageLeaveDays || 0) * 10) / 10
            },
            recentActivity: recentPayrolls.map(p => ({
                id: p._id,
                employeeName: p.employeeName,
                action: `Payroll ${p.status}`,
                amount: p.netSalary,
                date: p.updatedAt
            })),
            generatedAt: new Date().toISOString()
        };

        // 5. Store in Redis cache with 15-minute TTL
        await cacheService.setEx(cacheKey, DASHBOARD_CACHE_TTL, summaryData);

        logger.info('Dashboard summary generated and cached', {
            userId,
            ttl: DASHBOARD_CACHE_TTL
        });

        res.status(200).json({
            ...summaryData,
            _cached: false,
            _cacheTTL: DASHBOARD_CACHE_TTL
        });

    } catch (error) {
        logger.error('Failed to generate dashboard summary', {
            userId: req.userId,
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
};

/**
 * Helper function to manually invalidate the dashboard cache.
 * Called internally by other controllers when critical data changes.
 * 
 * @param {string} userId - The user whose cache should be invalidated
 */
exports.invalidateDashboardCache = async (userId) => {
    try {
        const cacheKey = getDashboardCacheKey(userId);
        await cacheService.del(cacheKey);
        logger.debug('Dashboard cache manually invalidated', { userId });
    } catch (error) {
        // Cache invalidation failures should not break the main operation
        logger.warn('Failed to invalidate dashboard cache', {
            userId,
            error: error.message
        });
    }
};
