/**
 * @fileoverview Dashboard Data Hooks (TanStack Query)
 * @description Custom hooks leveraging @tanstack/react-query to fetch, cache, 
 * and synchronize dashboard metrics. Replaces boilerplate useEffect/useState 
 * patterns with robust caching, automatic background refetching, and stale-while-revalidate logic.
 * 
 * Issue: #684
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/**
 * Query Keys factory for dashboard-related data.
 * Ensures consistent cache invalidation and refetching across the app.
 */
export const dashboardKeys = {
    all: ['dashboard'],
    summary: () => [...dashboardKeys.all, 'summary'],
    recentActivity: () => [...dashboardKeys.all, 'recent-activity'],
    payrollTrend: (months) => [...dashboardKeys.all, 'payroll-trend', months],
};

/**
 * Fetches the comprehensive dashboard summary (employee counts, payroll totals, etc.)
 * 
 * @returns {Object} TanStack Query result object (data, isLoading, error, refetch)
 */
export function useDashboardSummary() {
    return useQuery({
        queryKey: dashboardKeys.summary(),
        queryFn: async () => {
            const response = await api.get('/api/dashboard/summary');
            return response.data;
        },
        // Keep data fresh for 5 minutes before considering it stale
        staleTime: 5 * 60 * 1000,
        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Refetch when the window regains focus
        refetchOnWindowFocus: true,
        // Retry failed requests up to 2 times
        retry: 2,
    });
}

/**
 * Fetches recent activity feed for the dashboard
 * 
 * @param {number} limit - Number of recent activities to fetch
 * @returns {Object} TanStack Query result object
 */
export function useRecentActivity(limit = 10) {
    return useQuery({
        queryKey: [...dashboardKeys.recentActivity(), limit],
        queryFn: async () => {
            const response = await api.get(`/api/dashboard/recent-activity?limit=${limit}`);
            return response.data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
    });
}

/**
 * Fetches payroll trend data for charts
 * 
 * @param {number} months - Number of months to look back
 * @returns {Object} TanStack Query result object
 */
export function usePayrollTrend(months = 6) {
    return useQuery({
        queryKey: dashboardKeys.payrollTrend(months),
        queryFn: async () => {
            const response = await api.get(`/api/reports/analytics?months=${months}`);
            return response.data;
        },
        staleTime: 15 * 60 * 1000, // 15 minutes (analytics don't change rapidly)
    });
}

/**
 * Hook to invalidate dashboard caches after mutations (e.g., finalizing payroll)
 * 
 * @returns {Function} Function to trigger cache invalidation
 */
export function useInvalidateDashboard() {
    const queryClient = useQueryClient();

    return () => {
        // Invalidate all dashboard-related queries to force refetch
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    };
}
