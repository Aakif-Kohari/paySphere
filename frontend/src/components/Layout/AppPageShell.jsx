import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { useAppStore } from '../../store/useAppStore';

/**
 * Gives routed pages that do not own a sidebar the same application chrome as
 * the dashboard. This keeps navigation visible after following a sidebar link
 * to a standalone page such as Settlements or Loans.
 */
export default function AppPageShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useAppStore((state) => state.logout);
  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <>
      <Sidebar
        companyName={companyName}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open navigation sidebar"
        className="fixed left-3 top-3 z-30 rounded-lg bg-white p-2 text-slate-700 shadow-md ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 md:hidden"
      >
        ☰
      </button>
      <div className="min-h-screen md:pl-56">{children}</div>
    </>
  );
}
