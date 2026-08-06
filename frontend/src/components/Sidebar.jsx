import { useMemo } from 'react';
import GridViewIcon from '@mui/icons-material/GridView';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';

const Sidebar = ({
  companyName,
  activePage,
  setActivePage,
  isSidebarOpen,
  onClose,
}) => {
  const sidebarItems = useMemo(
    () => [
      { id: 'Dashboard', label: 'Dashboard', icon: <GridViewIcon /> },
      { id: 'Employees', label: 'Employees', icon: <PeopleIcon /> },
      { id: 'Payroll', label: 'Payroll History', icon: <AccountBalanceWalletIcon /> },
      { id: 'Approvals', label: 'Approvals', icon: <FactCheckIcon /> },
      { id: 'Settlements', label: 'Exits & F&F', icon: <LogoutIcon /> },
      { id: 'Loans', label: 'Advances', icon: <AccountBalanceWalletIcon /> },
      { id: 'Reports', label: 'Reports', icon: <AssessmentIcon /> },
    ],
    [],
  );

  const initials = useMemo(() => {
    return companyName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [companyName]);

  return (
    <>
      {isSidebarOpen && (
        <div role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
      >
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-200 dark:shadow-none">
              {initials}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">
                {companyName}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500">
                Payroll workspace
              </p>
            </div>
          </div>
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActivePage(item.id);
                onClose();
              }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activePage === item.id
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20 dark:shadow-none' /* Issue #521: Replaced hardcoded hex */
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
          <button
            onClick={() => {
              window.location.href = 'mailto:support@paysphere.com';
              onClose();
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            <HelpOutlineIcon />
            Help & Support
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
