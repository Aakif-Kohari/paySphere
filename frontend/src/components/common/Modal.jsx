/**
 * @fileoverview Accessible Modal Component
 * @description A fully accessible modal wrapper utilizing the useFocusTrap hook.
 * Handles backdrop clicks, Escape key closing, and ARIA attributes.
 * Supports both Light and Dark modes.
 * 
 * Issue: #1020
 */

import { useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Accessible Modal Component
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Controls visibility
 * @param {Function} props.onClose - Callback when modal requests closing
 * @param {string} props.title - Accessible title for the modal
 * @param {React.ReactNode} props.children - Modal content
 * @param {React.ReactNode} props.footer - Optional footer actions
 * @param {string} props.maxWidth - Tailwind max-width class
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  closeOnBackdrop = true
}) {
  // Initialize focus trap with scroll locking
  const modalRef = useFocusTrap(isOpen, { returnFocus: true, lockScroll: true });

  // Unique per-instance ids so aria-labelledby/aria-describedby don't collide
  // when more than one Modal is mounted at once.
  const generatedId = useId();
  const titleId = `modal-title-${generatedId}`;
  const descriptionId = `modal-description-${generatedId}`;

  /**
   * Handles Escape key to close the modal
   */
  const handleEscapeKey = useCallback((event) => {
    if (event.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, handleEscapeKey]);

  /**
   * Handles clicks on the backdrop (outside the modal content)
   */
  const handleBackdropClick = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`
          relative w-full ${maxWidth} 
          bg-white dark:bg-slate-800 
          rounded-2xl shadow-2xl 
          border border-gray-200 dark:border-slate-700 
          max-h-[90vh] flex flex-col 
          outline-none
          animate-slideUp
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <h2
            id={titleId}
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Close dialog"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Body */}
        <div
          id={descriptionId}
          className="px-6 py-4 overflow-y-auto flex-1 text-sm text-gray-700 dark:text-slate-300"
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  maxWidth: PropTypes.string,
  closeOnBackdrop: PropTypes.bool
};