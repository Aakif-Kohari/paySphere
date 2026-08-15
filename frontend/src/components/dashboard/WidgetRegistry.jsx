/**
 * @fileoverview Widget Registry
 * @description Maps widget IDs to their React components and default grid dimensions.
 * Issue: #932
 */
import SummaryCards from '../reports/SummaryCards';
import PayrollTrendChart from '../reports/PayrollTrendChart';
import DepartmentChart from '../reports/DepartmentChart';
import OvertimeChart from '../reports/OvertimeChart';

// Placeholder components for widgets that need specific data fetching
const PendingApprovalsWidget = () => (
    <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-400 text-sm">
        Pending Approvals List (Fetches independently)
    </div>
);

const RecentActivityWidget = () => (
    <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-400 text-sm">
        Recent Activity Feed
    </div>
);

export const WIDGET_REGISTRY = {
    'summary-cards': {
        title: 'Summary Cards',
        component: SummaryCards,
        defaultW: 12,
        defaultH: 2,
        minW: 6,
        minH: 2,
    },
    'payroll-trend': {
        title: 'Payroll Trend',
        component: PayrollTrendChart,
        defaultW: 6,
        defaultH: 4,
        minW: 4,
        minH: 3,
    },
    'department-breakdown': {
        title: 'Department Breakdown',
        component: DepartmentChart,
        defaultW: 6,
        defaultH: 4,
        minW: 4,
        minH: 3,
    },
    'overtime-analysis': {
        title: 'Overtime Analysis',
        component: OvertimeChart,
        defaultW: 6,
        defaultH: 4,
        minW: 4,
        minH: 3,
    },
    'pending-approvals': {
        title: 'Pending Approvals',
        component: PendingApprovalsWidget,
        defaultW: 6,
        defaultH: 4,
        minW: 4,
        minH: 3,
    },
    'recent-activity': {
        title: 'Recent Activity',
        component: RecentActivityWidget,
        defaultW: 6,
        defaultH: 4,
        minW: 4,
        minH: 3,
    },
};

export const DEFAULT_LAYOUT = [
    { i: 'summary-cards', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
    { i: 'payroll-trend', x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'department-breakdown', x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'pending-approvals', x: 0, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'recent-activity', x: 6, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
];
