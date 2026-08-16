import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import EmptyState from '../components/common/EmptyState';
import { formatCurrency } from '../utils/currency';
import DashboardSkeleton from '../components/common/skeleton/DashboardSkeleton';

export default function Archive() {
  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArchive = async () => {
      try {
        const response = await api.get('/api/archive/employees');
        setArchivedEmployees(response.data.data || []);
      } catch {
        setError('Failed to fetch archived records.');
      } finally {
        setLoading(false);
      }
    };
    fetchArchive();
  }, []);

  const currency = localStorage.getItem('currency') || 'INR';

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="animate-in fade-in zoom-in duration-500">
      <Helmet>
        <title>Archive | PaySphere</title>
      </Helmet>

      <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white">
            Archive
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            View soft-deleted records.
          </p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
          {error}
        </div>
      ) : archivedEmployees.length === 0 ? (
        <EmptyState
          title="No archived records"
          description="Deleted employees will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {archivedEmployees.map((emp) => (
            <div
              key={emp._id}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/30 opacity-75 transition-all"
            >
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {emp.fullName}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {emp.role} {emp.department ? `• ${emp.department}` : ''}
              </p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  Base Pay:
                </span>
                <span className="font-semibold">
                  {formatCurrency(emp.monthlySalary, currency)}
                </span>
              </div>
              {emp.deletedAt && (
                <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">
                    Deleted On:
                  </span>
                  <span className="text-red-500 font-medium">
                    {new Date(emp.deletedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
