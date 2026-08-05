/**
 * @fileoverview Standardized Pagination Component
 * @description Reusable pagination control that enforces consistent text-sm
 * typography and accessible navigation patterns across all table views.
 * 
 * Design System Rules (Issue #524):
 * - All text uses text-sm
 * - Buttons use consistent padding and hover states
 * - Supports dark/light mode theming
 * 
 * @component
 */

import PropTypes from 'prop-types';

/**
 * Standardized Pagination Component
 * 
 * @param {Object} props - Component props
 * @param {number} props.currentPage - Current active page (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.totalItems - Total number of items across all pages
 * @param {number} props.itemsPerPage - Number of items displayed per page
 * @param {Function} props.onPageChange - Callback when page changes
 * @returns {JSX.Element|null} The rendered pagination controls
 */
export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange
}) {
    // Don't render if there's only one page or no data
    if (totalPages <= 1 && totalItems <= itemsPerPage) {
        return null;
    }

    /**
     * Calculates the range of items currently being displayed
     * @returns {Object} Start and end indices
     */
    const getItemRange = () => {
        const start = (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(currentPage * itemsPerPage, totalItems);
        return { start, end };
    };

    const { start, end } = getItemRange();

    /**
     * Generates the array of page numbers to display
     * Shows current page, 1 page before, and 1 page after when possible
     * @returns {Array<number|string>} Array of page numbers and ellipses
     */
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);

            if (currentPage > 3) pages.push('...');

            const startPage = Math.max(2, currentPage - 1);
            const endPage = Math.min(totalPages - 1, currentPage + 1);

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) pages.push('...');

            pages.push(totalPages);
        }

        return pages;
    };

    const pageNumbers = getPageNumbers();

    /**
     * Base button classes for consistent styling
     */
    const baseButtonClasses = `
    relative inline-flex items-center px-4 py-2 
    text-sm font-medium 
    border border-gray-300 dark:border-slate-600 
    bg-white dark:bg-slate-800 
    text-gray-700 dark:text-slate-300 
    hover:bg-gray-50 dark:hover:bg-slate-700 
    focus:z-20 focus:outline-none focus:ring-2 focus:ring-blue-500 
    transition-colors duration-150
  `;

    const activeButtonClasses = `
    relative inline-flex items-center px-4 py-2 
    text-sm font-semibold 
    border border-blue-600 dark:border-blue-500 
    bg-blue-600 dark:bg-blue-600 
    text-white 
    focus:z-20 focus:outline-none focus:ring-2 focus:ring-blue-500
  `;

    const disabledButtonClasses = `
    relative inline-flex items-center px-4 py-2 
    text-sm font-medium 
    border border-gray-200 dark:border-slate-700 
    bg-gray-50 dark:bg-slate-900 
    text-gray-400 dark:text-slate-500 
    cursor-not-allowed
  `;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
            {/* Item Range Display - Standardized text-sm */}
            <div className="text-sm text-gray-700 dark:text-slate-300">
                Showing <span className="font-semibold text-gray-900 dark:text-white">{start}</span> to{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{end}</span> of{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span> results
            </div>

            {/* Pagination Controls */}
            <nav className="flex items-center gap-1" aria-label="Pagination">
                {/* Previous Button */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={currentPage === 1 ? disabledButtonClasses : baseButtonClasses}
                    aria-label="Go to previous page"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                </button>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1">
                    {pageNumbers.map((page, index) => (
                        <button
                            key={`page-${index}`}
                            onClick={() => typeof page === 'number' && onPageChange(page)}
                            disabled={page === '...'}
                            className={
                                page === currentPage
                                    ? activeButtonClasses
                                    : page === '...'
                                        ? `${baseButtonClasses} cursor-default hover:bg-white dark:hover:bg-slate-800`
                                        : baseButtonClasses
                            }
                            aria-current={page === currentPage ? 'page' : undefined}
                            aria-label={typeof page === 'number' ? `Go to page ${page}` : 'Ellipsis'}
                        >
                            {page}
                        </button>
                    ))}
                </div>

                {/* Next Button */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? disabledButtonClasses : baseButtonClasses}
                    aria-label="Go to next page"
                >
                    Next
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </nav>
        </div>
    );
}

Pagination.propTypes = {
    currentPage: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
    totalItems: PropTypes.number.isRequired,
    itemsPerPage: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired
};
