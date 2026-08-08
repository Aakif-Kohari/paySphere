/**
 * @fileoverview Accessible Input Component
 * @description A reusable text input component that strictly enforces WCAG 2.1 AA 
 * accessibility standards. Resolves `jsx-a11y/label-has-associated-control` by 
 * ensuring every label is explicitly linked to its input via `htmlFor` and `id`.
 * 
 * Features:
 * - Explicit label-input association
 * - ARIA attributes for error states and descriptions
 * - Dark/Light mode support
 * - Forwarded refs for external focus management
 * 
 * Issue: #660
 */

import { forwardRef, useId } from 'react';
import PropTypes from 'prop-types';

/**
 * Accessible Input Component
 * 
 * @param {Object} props - Component props
 * @param {string} props.label - The visible label text
 * @param {string} props.type - Input type (text, email, password, etc.)
 * @param {string} props.error - Error message to display
 * @param {string} props.helperText - Additional description text
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.className - Additional Tailwind classes
 * @param {React.Ref} ref - Forwarded ref for the input element
 * @returns {JSX.Element} The rendered input group
 */
const Input = forwardRef(function Input({
  label,
  type = 'text',
  error,
  helperText,
  required = false,
  className = '',
  id: customId,
  ...rest
}, ref) {
  // Generate a unique ID if one isn't provided, ensuring unique label-input pairing
  const generatedId = useId();
  const inputId = customId || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Determine which aria-describedby to use
  const describedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {/* Explicitly associated label using htmlFor */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-gray-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="text-danger-600 ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        aria-required={required}
        className={`
          w-full px-4 py-2.5 rounded-lg border 
          bg-white dark:bg-slate-900 
          text-gray-900 dark:text-white 
          placeholder-gray-400 dark:placeholder-slate-500
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
          ${error
            ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
            : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
          }
          ${className}
        `}
        {...rest}
      />

      {/* Error Message */}
      {error && (
        <p id={errorId} className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1" role="alert">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {/* Helper Text (only shown if no error) */}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-gray-500 dark:text-slate-400">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  error: PropTypes.string,
  helperText: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string
};

export default Input;
