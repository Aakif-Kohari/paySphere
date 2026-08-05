/**
 * @fileoverview Standardized DataTable Component
 * @description A reusable, accessible table component that enforces consistent
 * typography and styling across the PaySphere application.
 * 
 * Design System Rules (Issue #524):
 * - Table Headers: text-xs uppercase tracking-wider font-semibold
 * - Table Body Rows: text-sm text-gray-700 dark:text-slate-300
 * - Pagination Controls: text-sm
 * 
 * @component
 */

import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Standardized DataTable Component
 * 
 * @param {Object} props - Component props
 * @param {Array<Object>} props.columns - Column definitions [{ key, label, render, align }]
 * @param {Array<Object>} props.data - Array of data objects to display
 * @param {string} props.emptyMessage - Message to display when data is empty
 * @param {boolean} props.loading - Whether the table is in a loading state
 * @param {Function} props.onRowClick - Optional callback when a row is clicked
 * @param {string} props.keyField - The unique key field for each row (default: '_id')
 * @returns {JSX.Element} The rendered table component
 */
export default function DataTable({
    columns = [],
    data = [],
    emptyMessage = 'No data available',
    loading = false,
    onRowClick,
    keyField = '_id'
}) {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    /**
     * Handles column header clicks for sorting
     * @param {string} key - The column key to sort by
     */
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    /**
     * Sorts the data based on current sort configuration
     * @returns {Array} Sorted data array
     */
    const getSortedData = () => {
        if (!sortConfig.key) return data;

        return [...data].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const sortedData = getSortedData();

    /**
     * Renders the loading skeleton state
     * @returns {JSX.Element} Skeleton rows
     */
    const renderSkeleton = () => (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                    {columns.map((col, j) => (
                        <td key={j} className="px-6 py-4 whitespace-nowrap">
                            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );

    /**
     * Renders the empty state message
     * @returns {JSX.Element} Empty state row
     */
    const renderEmptyState = () => (
        <tr>
            <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-sm text-gray-500 dark:text-slate-400"
            >
                <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="font-medium">{emptyMessage}</p>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                {/* Standardized Table Header: text-xs uppercase tracking-wider */}
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                scope="col"
                                className={`
                  px-6 py-3 
                  text-xs font-semibold uppercase tracking-wider 
                  text-gray-500 dark:text-slate-400
                  ${column.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-slate-200 select-none' : ''}
                  ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
                `}
                                onClick={() => column.sortable && handleSort(column.key)}
                                aria-sort={
                                    sortConfig.key === column.key
                                        ? sortConfig.direction === 'asc' ? 'ascending' : 'descending'
                                        : 'none'
                                }
                            >
                                <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'
                                    }`}>
                                    {column.label}
                                    {column.sortable && sortConfig.key === column.key && (
                                        <span className="text-blue-600 dark:text-blue-400">
                                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* Standardized Table Body: text-sm */}
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {loading ? (
                        renderSkeleton()
                    ) : sortedData.length === 0 ? (
                        renderEmptyState()
                    ) : (
                        sortedData.map((row, rowIndex) => (
                            <tr
                                key={row[keyField] || rowIndex}
                                onClick={() => onRowClick && onRowClick(row)}
                                className={`
                  transition-colors duration-150
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50' : ''}
                  ${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-800/50'}
                `}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`
                      px-6 py-4 whitespace-nowrap 
                      text-sm text-gray-700 dark:text-slate-300
                      ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
                    `}
                                    >
                                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

DataTable.propTypes = {
    columns: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            render: PropTypes.func,
            sortable: PropTypes.bool,
            align: PropTypes.oneOf(['left', 'center', 'right'])
        })
    ).isRequired,
    data: PropTypes.arrayOf(PropTypes.object),
    emptyMessage: PropTypes.string,
    loading: PropTypes.bool,
    onRowClick: PropTypes.func,
    keyField: PropTypes.string
};
