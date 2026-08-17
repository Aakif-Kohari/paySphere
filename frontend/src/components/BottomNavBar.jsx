/**
 * @fileoverview Mobile Bottom Navigation Bar
 * @description A sticky bottom navigation component for mobile viewports (< 768px).
 * Replaces the sidebar on small screens to optimize thumb-reachability.
 * Supports dark/light mode and active state highlighting.
 * 
 * Issue: #1025
 */
import { useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SettingsIcon from '@mui/icons-material/Settings';
import ApprovalsIcon from '@mui/icons-material/TaskAlt';

/**
 * Navigation items configuration
 */
const NAV_ITEMS = [
    { id: 'dashboard', label: 'Home', path: '/dashboard', icon: DashboardIcon },
    { id: 'employees', label: 'Team', path: '/dashboard?tab=employees', icon: PeopleIcon },
    { id: 'approvals', label: 'Approvals', path: '/approvals', icon: ApprovalsIcon },
    { id: 'payroll', label: 'Payroll', path: '/reports', icon: ReceiptLongIcon },
    { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
];

/**
 * Bottom Navigation Bar Component
 */
export default function BottomNavBar() {
    const location = useLocation();
    const navigate = useNavigate();

    /**
     * Determines if a specific nav item is currently active based on the URL.
     */
    const isActive = (path) => {
        if (path.includes('?tab=')) {
            return location.pathname + location.search === path;
        }
        return location.pathname.startsWith(path.split('?')[0]);
    };

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 shadow-lg safe-area-bottom"
            role="navigation"
            aria-label="Mobile Main Navigation"
        >
            <ul className="flex items-center justify-around h-16 px-2">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <li key={item.id} className="flex-1 flex justify-center">
                            <button
                                onClick={() => navigate(item.path)}
                                className={`
                  flex flex-col items-center justify-center w-full h-full py-1 
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg
                  ${active
                                        ? 'text-brand-600 dark:text-brand-400'
                                        : 'text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
                                    }
                `}
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}>
                                    <Icon fontSize="small" />
                                </div>
                                <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-brand-600 dark:text-brand-400' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

BottomNavBar.propTypes = {};
