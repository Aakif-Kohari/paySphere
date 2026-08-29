/**
 * @fileoverview Confirmation Dialog Component
 * @description A specialized modal for confirming destructive or important actions.
 * Uses the base Modal component to ensure focus trapping and accessibility.
 * 
 * Issue: #1020
 */
import PropTypes from 'prop-types';
import Modal from './Modal';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * Confirmation Dialog
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Visibility state
 * @param {Function} props.onClose - Cancel callback
 * @param {Function} props.onConfirm - Confirm callback
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message
 * @param {string} props.confirmText - Text for the confirm button
 * @param {string} props.cancelText - Text for the cancel button
 * @param {string} props.variant - 'danger' or 'primary'
 * @param {boolean} props.isLoading - Loading state for confirm button
 */
export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed? This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}) {
    const confirmButtonClasses = variant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        : 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500';

    const footer = (
        <>
            <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
            >
                {cancelText}
            </button>
            <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 flex items-center gap-2 ${confirmButtonClasses}`}
            >
                {isLoading && (
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {confirmText}
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} maxWidth="max-w-md" closeOnBackdrop={!isLoading}>
            <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                    <WarningAmberIcon className={variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'} />
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                    {message}
                </p>
            </div>
        </Modal>
    );
}

ConfirmDialog.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    title: PropTypes.string,
    message: PropTypes.string,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    variant: PropTypes.oneOf(['danger', 'primary']),
    isLoading: PropTypes.bool
};
