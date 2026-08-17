/**
 * @fileoverview Virtualized Table Row Component
 * @description Renders a single row for the virtualized employee table.
 * Receives style and index from react-window.
 * 
 * Issue: #1030
 */
import PropTypes from 'prop-types';
import { formatCurrency } from '../../utils/currency';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * Employee Table Row
 * 
 * @param {Object} props - react-window injected props
 * @param {number} props.index - Row index
 * @param {Object} props.style - Absolute positioning styles from react-window
 * @param {Array} props.data - The full data array
 */
export function EmployeeTableRow({ index, style, data }) {
    const employee = data[index];
    const currency = localStorage.getItem('currency') || 'INR';

    // Alternating row backgrounds for readability
    const isEven = index % 2 === 0;
    const rowBg = isEven
        ? 'bg-white dark:bg-slate-800'
        : 'bg-gray-50/50 dark:bg-slate-800/50';

    return (
        <div
            style={style}
            className={`
        flex items-center px-6 border-b border-gray-100 dark:border-slate-700/50 
        hover:bg-brand-50/50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer
        ${rowBg}
      `}
        >
            {/* Avatar & Name */}
            <div className="w-1/4 flex items-center gap-3 min-w-[200px]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {employee.fullName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {employee.fullName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {employee.email}
                    </p>
                </div>
            </div>

            {/* Role */}
            <div className="w-1/5 text-sm text-gray-700 dark:text-slate-300 truncate min-w-[120px]">
                {employee.role || 'N/A'}
            </div>

            {/* Department */}
            <div className="w-1/5 text-sm text-gray-700 dark:text-slate-300 truncate min-w-[120px]">
                {employee.department || 'N/A'}
            </div>

            {/* Salary */}
            <div className="w-1/5 text-sm font-mono text-right text-gray-900 dark:text-white min-w-[100px]">
                {formatCurrency(employee.monthlySalary || 0, currency)}
            </div>

            {/* Status */}
            <div className="w-1/5 flex justify-center min-w-[100px]">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${employee.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                    {employee.isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            {/* Actions */}
            <div className="w-16 flex justify-end min-w-[60px]">
                <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <MoreVertIcon fontSize="small" />
                </button>
            </div>
        </div>
    );
}

EmployeeTableRow.propTypes = {
    index: PropTypes.number.isRequired,
    style: PropTypes.object.isRequired,
    data: PropTypes.array.isRequired
};
