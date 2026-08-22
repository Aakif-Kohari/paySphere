import { formatCurrency as _formatCurrency } from './formatLocale';

export const getCurrencySymbol = (currencyCode = 'INR') => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  return symbols[currencyCode] || currencyCode;
};

/**
 * Formats a currency amount using the user's active locale (via i18next).
 * The locale is no longer derived from the currency code.
 */
export const formatCurrency = (amount, currencyCode = 'INR') =>
  _formatCurrency(amount, currencyCode);

