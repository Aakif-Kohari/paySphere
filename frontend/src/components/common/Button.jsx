/**
 * @fileoverview Universal Button Component
 * @description A highly reusable, accessible button component that enforces 
 * the new brand color palette (Issue #521). Replaces all hardcoded hex values 
 * with semantic Tailwind classes (e.g., `bg-brand-600`).
 * 
 * Features:
 * - Multiple variants (primary, secondary, outline, ghost, danger)
 * - Multiple sizes (sm, md, lg)
 * - Loading states with disabled interaction
 * - Dark/Light mode support via CSS variables and Tailwind dark: prefix
 * - WCAG AA compliant contrast ratios
 * 
 * Issue: #521
 */

import PropTypes from 'prop-types';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Button Component
 * 
 * @param {Object} props - Component props
 * @param {'primary'|'secondary'|'outline'|'ghost'|'danger'} props.variant - Button style variant
 * @param {'sm'|'md'|'lg'} props.size - Button size
 * @param {boolean} props.loading - Shows spinner and disables button
 * @param {boolean} props.disabled - Disables button interaction
 * @param {boolean} props.fullWidth - Makes button 100% width
 * @param {React.ReactNode} props.leftIcon - Icon to render before text
 * @param {React.ReactNode} props.rightIcon - Icon to render after text
 * @param {string} props.className - Additional Tailwind classes
 * @param {React.ReactNode} props.children - Button text/content
 * @returns {JSX.Element} The rendered button
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...rest
}) {
  // Base classes applied to all variants
  const baseClasses = `
    inline-flex items-center justify-center gap-2 
    font-semibold rounded-lg 
    transition-all duration-200 ease-in-out
    focus-ring-brand
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    select-none
  `;

  // Size mappings
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  // Variant mappings (Strictly using brand-* semantic tokens, NO hardcoded hexes)
  const variantClasses = {
    primary: `
      bg-brand-600 text-white 
      hover:bg-brand-700 
      active:bg-brand-800 
      shadow-sm shadow-brand-500/20 dark:shadow-none
      dark:bg-brand-600 dark:hover:bg-brand-500
    `,
    secondary: `
      bg-slate-100 text-slate-900 
      hover:bg-slate-200 
      active:bg-slate-300
      dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700
    `,
    outline: `
      bg-transparent text-brand-600 
      border border-brand-600 
      hover:bg-brand-50 
      active:bg-brand-100
      dark:text-brand-400 dark:border-brand-400 dark:hover:bg-brand-950/50
    `,
    ghost: `
      bg-transparent text-slate-700 
      hover:bg-slate-100 
      active:bg-slate-200
      dark:text-slate-300 dark:hover:bg-slate-800
    `,
    danger: `
      bg-danger-600 text-white 
      hover:bg-danger-700 
      active:bg-danger-800
      shadow-sm shadow-danger-500/20 dark:shadow-none
    `
  };

  const combinedClasses = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      className={combinedClasses}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <CircularProgress
          size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
          thickness={5}
          sx={{
            color: variant === 'primary' || variant === 'danger' ? 'white' : 'currentColor'
          }}
        />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
  className: PropTypes.string,
  children: PropTypes.node.isRequired
};
