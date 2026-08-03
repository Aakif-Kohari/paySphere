import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Snackbar, Alert } from '@mui/material';

import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';

// --- Recharts Components ---
import SummaryCards from '../components/reports/SummaryCards';
import PayrollTrendChart from '../components/reports/PayrollTrendChart';
import DepartmentChart from '../components/reports/DepartmentChart';
import SalaryDistributionChart from '../components/reports/SalaryDistributionChart';
import OvertimeChart from '../components/reports/OvertimeChart';
import PayrollTable from '../components/reports/PayrollTable';
import ScheduleReportModal from '../components/reports/ScheduleReportModal';
import CustomReportBuilder from '../components/reports/CustomReportBuilder';
import TurnoverMetrics from '../components/reports/TurnoverMetrics';
// --- Month-Year Selector ---
const REPORT_TABS = [
  { id: 'analytics', label: 'Payroll Analytics' },
  { id: 'hr', label: 'HR Metrics' },
  { id: 'custom', label: 'Custom Report' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MonthYearSelector = ({ month, year, onChange }) => (
  <div className="flex gap-3">
    <select
      value={month}
      onChange={(e) => onChange(Number(e.target.value), year)}
      className="px-4 py-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
    >
      {MONTH_NAMES.map((name, i) => (
        <option key={i} value={i + 1}>{name}</option>
      ))}
    </select>
    <select
      value={year}
      onChange={(e) => onChange(month, Number(e.target.value))}
      className="px-4 py-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
    >
      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  </div>
);

// --- Download Helper ---
const downloadFileWithProgress = async (url, filename, type, setExportingType, setSnackbar) => {
  const token = localStorage.getItem('token');
  const baseUrl =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
      ? typeof window !== 'undefined'
        ? window.location.origin
        : ''
      : 'http://localhost:5000');
  setExportingType(type);
  try {
    const res = await fetch(`${baseUrl}${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to generate report');
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setSnackbar({ open: true, message: 'Download completed successfully!', severity: 'success' });
  } catch (err) {
    console.error('Export failed:', err);
    setSnackbar({ open: true, message: err.message || 'Failed to download report. No data for the selected period.', severity: 'error' });
  } finally {
    setExportingType(null);
  }
};

export default function Reports() {
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const [activePage, setActivePage] = useState('Reports');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  // Three branches below switch on this, but nothing ever declared it, so every
  // render of this page threw `ReferenceError: activeTab is not defined` and the
  // Reports route was blank. 'analytics' is the default because it is the view
  // the export bar and the month selector belong to.
  const [activeTab, setActiveTab] = useState('analytics');
  
  const companyName = localStorage.getItem('companyName') || 'PaySphere';

  useEffect(() => {
    if (!token) navigate('/auth');
  }, [token, navigate]);

  useEffect(() => {
    const fetchReportsData = async () => {
      setLoading(true);
      try {
        const [analyticsRes, summaryRes] = await Promise.all([
          api.get('/api/reports/analytics?months=6'),
          api.get(`/api/payroll/summary?month=${month}&year=${year}`)
        ]);

        const analytics = analyticsRes.data;
        const payrolls = summaryRes.data.payrolls || [];

        // Format for Recharts components
        const formattedData = {
          summary: {
            totalPayroll: `₹${analytics.summary.totalPayout.toLocaleString('en-IN')}`,
            employeesPaid: analytics.summary.totalRecords, // Backend doesn't return Paid vs Draft count in analytics
            averageSalary: `₹${(analytics.summary.totalRecords > 0 ? Math.round(analytics.summary.totalPayout / analytics.summary.totalRecords) : 0).toLocaleString('en-IN')}`,
            overtime: `₹${analytics.summary.totalOvertime.toLocaleString('en-IN')}`,
            deductions: `₹${analytics.summary.totalDeductions.toLocaleString('en-IN')}`,
          },
          trend: analytics.monthlyTrends.map(t => ({
            month: t.label,
            payroll: t.totalPayout
          })),
          department: analytics.roleBreakdown.map(r => ({
            department: r.role,
            payroll: r.totalPayout
          })),
          salary: [
            { name: "Salary", value: analytics.summary.totalBase },
            { name: "Bonus", value: analytics.summary.totalBonus },
            { name: "Overtime", value: analytics.summary.totalOvertime }
          ],
          overtime: payrolls.map(p => ({
            employee: p.employeeName,
            overtime: p.overtimePay,
            deductions: p.deductions + p.leaveDeduction
          })),
          table: payrolls.map(p => ({
            id: p._id,
            name: p.employeeName,
            department: p.role,
            salary: `₹${p.baseSalary.toLocaleString('en-IN')}`,
            bonus: `₹${p.bonus.toLocaleString('en-IN')}`,
            overtime: `₹${p.overtimePay.toLocaleString('en-IN')}`,
            deduction: `₹${(p.deductions + p.leaveDeduction).toLocaleString('en-IN')}`,
            net: `₹${p.netSalary.toLocaleString('en-IN')}`,
            status: p.status || "Paid", // Backend uses Paid/Draft
            date: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "-",
          }))
        };

        setReportData(formattedData);
      } catch (err) {
        console.error('Failed to fetch reports data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchReportsData();
  }, [token, month, year]);

  const handleMonthChange = (m, y) => {
    setMonth(m);
    setYear(y);
  };

  const handleDownloadPDF = () => {
    downloadFileWithProgress(
      `/api/reports/download-pdf?month=${month}&year=${year}`,
      `payroll-report-${MONTH_NAMES[month - 1]}-${year}.pdf`,
      'pdf',
      setExportingType,
      setSnackbar
    );
  };

  const handleExportCSV = () => {
    downloadFileWithProgress(
      `/api/payroll/export-csv?month=${month}&year=${year}`,
      `payroll-export-${MONTH_NAMES[month - 1]}-${year}.csv`,
      'csv',
      setExportingType,
      setSnackbar
    );
  };

  const handleExportXLSX = () => {
    downloadFileWithProgress(
      `/api/reports/export-xlsx?month=${month}&year=${year}`,
      `payroll-summary-${MONTH_NAMES[month - 1]}-${year}.xlsx`,
      'xlsx',
      setExportingType,
      setSnackbar
    );
  };

  const handleDownloadZIP = () => {
    downloadFileWithProgress(
      `/api/reports/download-zip?month=${month}&year=${year}`,
      `payslips-${MONTH_NAMES[month - 1]}-${year}.zip`,
      'zip',
      setExportingType,
      setSnackbar
    );
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const getInitials = (name) =>
    name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>Reports & Analytics | PaySphere</title>
        <meta name="description" content={`View payroll analytics and generate reports for ${companyName}.`} />
      </Helmet>

      <Sidebar
        companyName={companyName}
        activePage={activePage}
        setActivePage={(page) => {
          setActivePage(page);
          if (page !== 'Reports') navigate(`/${page.toLowerCase()}`);
        }}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">Ledger Payroll</span>
          </div>
          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-500">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {getInitials(companyName)}
            </div>
            <button
              onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('companyName'); navigate('/'); }}
              className="px-3 py-1.5 cursor-pointer text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="p-1 rounded-md text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800 transition"
                >
                  <ArrowBackIcon fontSize="small" />
                </button>
                <p className="text-sm text-gray-500 dark:text-slate-500">Payroll Analytics</p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white">Reports</h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-4 sm:mt-0 items-center">
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                Schedule Report
              </button>
              <MonthYearSelector month={month} year={year} onChange={handleMonthChange} />
            </div>
          </div>

          {/* View switcher. TurnoverMetrics and CustomReportBuilder are imported
              and rendered by the branches further down, but with no control to
              set `activeTab` there was no way to reach either of them. */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 dark:border-slate-800">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export Action Bar */}
          {activeTab === 'analytics' && (
          <div className="flex flex-wrap gap-3 mb-8 items-center">
            <button
              onClick={handleDownloadPDF}
              disabled={Boolean(exportingType)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {exportingType === 'pdf' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {exportingType === 'pdf' ? 'Compiling PDF...' : 'Download PDF Report'}
            </button>

            <button
              onClick={handleDownloadZIP}
              disabled={Boolean(exportingType)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {exportingType === 'zip' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              )}
              {exportingType === 'zip' ? 'Compiling Payslips ZIP...' : 'Download All Payslips (ZIP)'}
            </button>

            <button
              onClick={handleExportXLSX}
              disabled={Boolean(exportingType)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-md shadow-emerald-200 dark:shadow-none transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {exportingType === 'xlsx' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {exportingType === 'xlsx' ? 'Compiling Excel...' : 'Export Payroll Summary (.xlsx)'}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={Boolean(exportingType)}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {exportingType === 'csv' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {exportingType === 'csv' ? 'Exporting CSV...' : 'Export Accounting CSV'}
            </button>
          </div>
          )}

          {exportingType && (
            <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Compiling and generating exported file for {MONTH_NAMES[month - 1]} {year}... Please wait.
              </span>
            </div>
          )}


          {activeTab === 'hr' ? (
            <TurnoverMetrics />
          ) : activeTab === 'custom' ? (
            <CustomReportBuilder />
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : !reportData || reportData.table.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-20 h-20 mx-auto text-gray-300 dark:text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No payroll data yet</h3>
              <p className="text-gray-500 dark:text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                Run payroll for at least one month to see analytics and generate reports.
              </p>
              <button
                onClick={() => navigate('/monthly-updates')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none"
              >
                Run Payroll
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recharts Components from PR #245 */}
              <SummaryCards data={reportData.summary} />
              
              <PayrollTrendChart data={reportData.trend} />
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <DepartmentChart data={reportData.department} />
                <SalaryDistributionChart data={reportData.salary} />
              </div>
              
              <OvertimeChart data={reportData.overtime} />
              
              <PayrollTable data={reportData.table} />
            </div>
          )}
        </main>
      </div>

      <ScheduleReportModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)}
        onScheduled={() => setSnackbar({ open: true, message: 'Report scheduled successfully!', severity: 'success' })}
      />

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
