import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GridViewIcon from '@mui/icons-material/GridView';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import { useEffect, useMemo, useRef } from 'react';
import ThemeToggle from './ThemeToggle';

const Sidebar = ({
  companyName,
  activePage,
  setActivePage,
  isSidebarOpen,
  onClose,
}) => {
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isSidebarOpen, onClose]);
  const sidebarItems = useMemo(
    () => [
      { id: 'Dashboard', label: 'Dashboard', icon: <GridViewIcon /> },
      { id: 'Employees', label: 'Employees', icon: <PeopleIcon /> },
      {
        id: 'Payroll',
        label: 'Payroll History',
        icon: <AccountBalanceWalletIcon />,
      },
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
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 fixed inset-y-0 left-0 flex flex-col z-50 transition-transform duration-300 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        ref={sidebarRef}
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
              className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition ${
                activePage === item.id
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-gray-500 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
          <ThemeToggle showLabel className="w-full" />
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
