import DownloadIcon from '@mui/icons-material/Download';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import Sidebar from '../components/Sidebar';
import EmployeeCard from '../components/EmployeeCard';
import SettingsModal from '../components/SettingsModal';
import EmptyState from '../components/common/EmptyState';
import {
  EmployeeBreakdownSkeleton,
  EmployeeCardSkeleton,
  StatCardSkeleton,
} from '../components/common/Skeleton';
import api from '../services/api';
import { exportEmployeesToCsv } from '../utils/exportEmployeesToCsv';

// Trigger a file download from the browser
const downloadFile = (url, filename) => {
  const token = localStorage.getItem('token');
  fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error('No data to export');
      return res.blob();
    })
    .then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    })
    .catch((err) => {
      console.error('Export failed:', err);
      alert(
        'No payroll data found for the current month. Finalize payroll first.',
      );
    });
};

// --- Dashboard Overview Component ---
const DashboardOverview = ({
  search,
  setSearch,
  filtered,
  onAddUpdate,
  onAddEmployee,
  totalPayout,
  employeeCount,
  loading,
  payrolls,
}) => {
  const payrollMap = {};
  (payrolls || []).forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const [gettingStarted, setGettingStarted] = useState(() => {
    return localStorage.getItem('showGettingStartedCard') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('showGettingStartedCard', gettingStarted);
  }, [gettingStarted]);

  function handleCloseBtn() {
    setGettingStarted(false);
  }

  return (
    <main className="p-4 sm:p-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-400 dark:text-slate-400">
            Monthly Overview
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white">
            {new Date().toLocaleString('default', {
              month: 'long',
              year: 'numeric',
            })}
          </h1>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 cursor-pointer sm:flex-none px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 transition-colors">
            Reports
          </button>

          <button
            onClick={() =>
              downloadFile('/api/payroll/export-csv', `payroll-export.csv`)
            }
            className="flex-1 cursor-pointer sm:flex-none px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 transition-colors"
          >
            Export CSV
          </button>

          <button
            onClick={onAddUpdate}
            className="flex-1 cursor-pointer sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none"
          >
            Run Payroll
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        {loading ? (
          <>
            <StatCardSkeleton />
            <div className="w-full sm:w-64">
              <StatCardSkeleton />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
              <p className="text-xs uppercase text-gray-400 dark:text-slate-400 font-bold mb-2">
                Total Monthly Payout
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                ₹{totalPayout.toLocaleString('en-IN')}
              </h2>
              <p className="text-gray-400 dark:text-slate-400 text-sm mt-2">
                {employeeCount} employees on payroll
              </p>
            </div>

            <div className="w-full sm:w-64 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
              <p className="text-xs uppercase text-gray-400 dark:text-slate-400 font-bold mb-2">
                Employees
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                {employeeCount}
              </h2>
              <p className="text-gray-400 dark:text-slate-400 text-sm">
                Active this month
              </p>
            </div>
          </>
        )}
      </div>

      {/* Getting Started */}
      {gettingStarted && (
        <div className="relative mx-auto my-8 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={handleCloseBtn}
            aria-label="Dismiss tutorial"
            className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>

          <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            Getting Started
          </h2>
          <p className="text-gray-600 dark:text-slate-400">
            New to PaySphere? Watch this quick tutorial to learn how to navigate
            the application and get started.
          </p>

          <a
            href="https://youtu.be/N3SizOsiNGw"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-blue-700"
          >
            ▶ Watch Tutorial
          </a>
        </div>
      )}

      {/* Search + Export Roster */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Employee Directory
        </h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none transition-colors"
          />

          <button
            type="button"
            disabled={loading || filtered.length === 0}
            onClick={() =>
              exportEmployeesToCsv(filtered, {
                companyName: localStorage.getItem('companyName') || 'PaySphere',
              })
            }
            title={
              filtered.length === 0
                ? 'No employees to export'
                : `Export ${filtered.length} employee${filtered.length === 1 ? '' : 's'} to CSV`
            }
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-lg text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
          >
            <DownloadIcon sx={{ fontSize: 18 }} />
            Export Roster
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <EmployeeCardSkeleton key={i} />
          ))
        ) : filtered.length === 0 && !search ? (
          <EmptyState
            title="No employees yet"
            description="Add your first employee to get started with payroll."
            action={
              <button
                onClick={onAddEmployee}
                className="px-6 py-2.5 bg-blue-600 cursor-pointer hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none"
              >
                + Add Employee
              </button>
            }
          />
        ) : filtered.length === 0 && search ? (
          <EmptyState
            title="No employees found"
            description={`No employees match "${search}". Try a different name or role.`}
          />
        ) : (
          filtered.map((emp) => (
            <EmployeeCard
              key={emp._id}
              emp={emp}
              payroll={payrollMap[emp._id]}
              variant="overview"
              onAddUpdate={onAddUpdate}
            />
          ))
        )}

        {!loading && (filtered.length > 0 || search) && (
          <div
            onClick={onAddEmployee}
            className="border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-44 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition duration-200"
          >
            <p className="text-gray-400 dark:text-slate-400 font-semibold">
              + Add Employee
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

// --- Employee Management Component ---
const EmployeeManagement = ({
  employees,
  loading,
  onAddEmployee,
  onAddUpdate,
  payrolls,
  currentPage,
  totalPages,
  setCurrentPage,
  onDeleteEmployee,
}) => {
  const payrollMap = {};
  (payrolls || []).forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const totalNet = employees.reduce((s, e) => {
    const p = payrollMap[e._id];
    return s + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  return (
    <main className="p-4 sm:p-8">
      {/* Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center mb-8 gap-6 transition-colors duration-200">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50 mb-4">
            Payroll done in 30 seconds
          </span>
          <p className="text-sm text-gray-400 dark:text-slate-400 mb-1">
            Final Summary
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white mb-2">
            ₹{totalNet.toLocaleString('en-IN')}
          </h1>
          <p className="text-sm text-gray-400 dark:text-slate-400">
            Total Monthly Payout for{' '}
            <span className="text-gray-700 dark:text-slate-200 font-semibold">
              {employees.length} Employee{employees.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={onAddUpdate}
            className="flex-1 sm:flex-none cursor-pointer px-5 py-3 border border-gray-200 dark:border-slate-800 rounded-xl font-semibold text-gray-700 dark:text-slate-200 hover:shadow dark:hover:bg-slate-800 transition-colors"
          >
            Edit Updates
          </button>
          <button className="flex-1 sm:flex-none cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 dark:shadow-none">
            Finish & Pay
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <EmployeeBreakdownSkeleton key={i} />
          ))
        ) : employees.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Add employees to see their salary breakdown here."
            action={
              <button
                onClick={onAddEmployee}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none"
              >
                + Add Employee
              </button>
            }
          />
        ) : (
          employees.map((emp) => (
            <EmployeeCard
              key={emp._id}
              emp={emp}
              payroll={payrollMap[emp._id]}
              variant="breakdown"
              onDeleteEmployee={onDeleteEmployee}
            />
          ))
        )}

        {!loading && employees.length > 0 && (
          <div
            onClick={onAddEmployee}
            className="border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-48 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition duration-200"
          >
            <p className="text-gray-400 dark:text-slate-400 font-semibold">
              + Add more employees
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
};

export default function PaySphereDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [payrolls, setPayrolls] = useState([]);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const companyName = localStorage.getItem('companyName') || 'Acme Corp';
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, payRes] = await Promise.all([
          api.get(`/api/employees?page=${currentPage}&limit=10`),
          api.get(`/api/payroll/summary`),
        ]);

        setEmployees(empRes.data.employees);
        setTotalPages(empRes.data.totalPages);
        setPayrolls(payRes.data.payrolls || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
    else setTimeout(() => setLoading(false), 0);
  }, [token, currentPage]);

  const payrollMap = {};
  payrolls.forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const totalPayout = employees.reduce((sum, e) => {
    const p = payrollMap[e._id];
    return sum + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  const filtered = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.role || '').toLowerCase().includes(search.toLowerCase()),
  );
  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setDeleting(true);

      await api.delete(`/api/employees/${employeeToDelete._id}`);

      setEmployees((prev) =>
        prev.filter((emp) => emp._id !== employeeToDelete._id),
      );

      setPayrolls((prev) =>
        prev.filter((p) => p.employeeId !== employeeToDelete._id),
      );

      setEmployeeToDelete(null);
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.message || 'Failed to delete employee');
    } finally {
      setDeleting(false);
    }
  };
  const getInitials = (name) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>
          {activePage === 'Dashboard'
            ? 'Payroll Dashboard | PaySphere'
            : 'Employee Management | PaySphere'}
        </title>
        <meta
          name="description"
          content={`Manage ${companyName}'s payroll and employees with ease.`}
        />
      </Helmet>

      {/* Sidebar (extracted component) */}
      <Sidebar
        companyName={companyName}
        activePage={activePage}
        setActivePage={setActivePage}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">
              Ledger Payroll
            </span>
            <button className="hidden sm:block text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-blue-600 dark:border-blue-400 pb-0.5 whitespace-nowrap">
              {new Date().toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {getInitials(companyName)}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('companyName');
                navigate('/');
              }}
              className="px-3 py-1.5 cursor-pointer text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        {activePage === 'Dashboard' ? (
          <DashboardOverview
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            onAddUpdate={() => navigate('/monthly-updates')}
            onAddEmployee={() => navigate('/add-employee')}
            totalPayout={totalPayout}
            employeeCount={employees.length}
            loading={loading}
            payrolls={payrolls}
          />
        ) : (
          <EmployeeManagement
            employees={employees}
            loading={loading}
            onAddEmployee={() => navigate('/add-employee')}
            onAddUpdate={() => navigate('/monthly-updates')}
            payrolls={payrolls}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            onDeleteEmployee={(emp) => setEmployeeToDelete(emp)}
          />
        )}

        {/* Delete Confirmation Modal */}
        {employeeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-96 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Delete Employee?
              </h2>

              <p className="mt-3 text-gray-600 dark:text-slate-400">
                Are you sure you want to delete{' '}
                <span className="font-semibold">
                  {employeeToDelete.fullName}
                </span>
                ?
                <br />
                Payroll records will also be deleted.
              </p>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEmployeeToDelete(null)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>

                <button
                  disabled={deleting}
                  onClick={handleDeleteEmployee}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings modal (extracted component).
          Kept for future use; not wired to a trigger today, so
          no visual change occurs. */}
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      >
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Settings will be available here soon.
        </p>
      </SettingsModal>
    </div>
  );
}
