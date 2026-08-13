/**
 * @fileoverview Payroll Table Component
 * @description Displays payroll records for a specific month with standardized
 * typography and formatting. Uses text-xs uppercase for headers and text-sm for body.
 *
 * Issue: #524 (Typography Standardization)
 */

import PropTypes from 'prop-types';
import { formatCurrency } from '../../utils/currency';

import useVirtual from '../../hooks/useVirtual';

/**
 * PayrollTable Component
 *
 * @param {Object} props - Component props
 * @param {Array} props.data - Array of payroll record objects
 * @param {string} props.currency - Currency code for formatting
 * @returns {JSX.Element} The rendered payroll table
 */
export default function PayrollTable({ data = [], currency = 'INR' }) {
  const { virtualItems, startIndex, endIndex, containerRef } = useVirtual({
    itemCount: data.length,
    itemHeight: 73,
    overscan: 5,
  });

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No payroll records available for this period.
        </p>
      </div>
    );
  }

  const paddingTop = startIndex * 73;
  const paddingBottom = (data.length - endIndex - 1) * 73;

  /**
   * Renders a status badge with appropriate color coding
   * @param {string} status - The payroll status
   * @returns {JSX.Element} Status badge
   */
  const renderStatusBadge = (status) => {
    const statusConfig = {
      paid: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-800 dark:text-green-300',
        label: 'Paid',
      },
      approved: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-800 dark:text-blue-300',
        label: 'Approved',
      },
      pending_approval: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-800 dark:text-yellow-300',
        label: 'Pending',
      },
      rejected: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-800 dark:text-red-300',
        label: 'Rejected',
      },
      finalized: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-800 dark:text-purple-300',
        label: 'Finalized',
      },
    };

    const config =
      statusConfig[status?.toLowerCase()] || statusConfig.pending_approval;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div ref={containerRef} className="overflow-auto max-h-[600px]">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 table-fixed">
          {/* Standardized Header: text-xs uppercase tracking-wider */}
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Employee
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Department
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Base Salary
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Overtime
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Deductions
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Net Salary
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400"
              >
                Status
              </th>
            </tr>
          </thead>

          {/* Standardized Body: text-sm */}
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {paddingTop > 0 && (
              <tr style={{ height: `${paddingTop}px` }}>
                <td
                  colSpan={7}
                  style={{ height: `${paddingTop}px`, padding: 0 }}
                />
              </tr>
            )}
            {virtualItems.map((item) => {
              const row = data[item.index];
              return (
                <tr
                  key={row.id || item.index}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors duration-150"
                  style={{ height: '73px' }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                        {row.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {row.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {row.date || '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                    {row.department || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300 text-right font-mono">
                    {formatCurrency(row.salary, currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right font-mono">
                    +{formatCurrency(row.overtime, currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right font-mono">
                    -{formatCurrency(row.deduction, currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right font-mono">
                    {formatCurrency(row.net, currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {renderStatusBadge(row.status)}
                  </td>
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr style={{ height: `${paddingBottom}px` }}>
                <td
                  colSpan={7}
                  style={{ height: `${paddingBottom}px`, padding: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

PayrollTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string.isRequired,
      department: PropTypes.string,
      salary: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      overtime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      deduction: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      net: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      status: PropTypes.string,
      date: PropTypes.string,
    }),
  ),
  currency: PropTypes.string,
};
