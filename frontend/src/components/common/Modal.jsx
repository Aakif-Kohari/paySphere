/**
 * @fileoverview Universal Modal Component
 * @description A reusable modal wrapper that ensures the backdrop covers the 
 * entire viewport using `fixed inset-0`, preventing the ultra-wide monitor 
 * bug where `h-screen` fails to cover scrolled content or oversized viewports.
 * 
 * Features:
 * - Fixed viewport coverage (Issue #503)
 * - Dark/Light mode support
 * - Accessibility (ARIA roles, focus trapping, Escape key closing)
 * - Smooth enter/exit animations
 * 
 * Issue: #503
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Modal Component
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal requests closing
 * @param {string} props.title - Modal header title
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} props.footer - Optional footer actions
 * @param {string} props.maxWidth - Tailwind max-width class (e.g., 'max-w-lg')
 * @param {boolean} props.closeOnBackdropClick - Whether clicking backdrop closes modal
 * @returns {JSX.Element|null} The rendered modal portal
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  closeOnBackdropClick = true
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  /**
   * Handles Escape key press to close the modal
   * @param {KeyboardEvent} e - Keyboard event
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  /**
   * Traps focus inside the modal for accessibility
   * @param {KeyboardEvent} e - Keyboard event
   */
  const handleTabKey = useCallback((e) => {
    if (e.key !== 'Tab') return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Store previously focused element to restore later
      previousActiveElement.current = document.activeElement;

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Attach event listeners
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleTabKey);

      // Focus the modal container
      setTimeout(() => modalRef.current?.focus(), 50);
    } else {
      // Restore body scroll
      document.body.style.overflow = 'unset';

      // Remove event listeners
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleTabKey);

      // Restore focus to previously active element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen, handleKeyDown, handleTabKey]);

  if (!isOpen) return null;

  /**
   * Handles backdrop click
   * @param {React.MouseEvent} e - Mouse event
   */
  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      className={`
        fixed inset-0 z-[100] 
        flex items-center justify-center 
        bg-black/60 backdrop-blur-sm 
        transition-opacity duration-300 ease-in-out
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`
          relative w-full ${maxWidth} mx-4 
          bg-white dark:bg-slate-800 
          rounded-2xl shadow-2xl 
          border border-gray-200 dark:border-slate-700
          transform transition-all duration-300 ease-out
          ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
          max-h-[90vh] flex flex-col
          outline-none
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2
            id="modal-title"
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close modal"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 text-sm text-gray-700 dark:text-slate-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render via portal to escape parent overflow constraints
  return createPortal(modalContent, document.body);
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  maxWidth: PropTypes.string,
  closeOnBackdropClick: PropTypes.bool
};
