import { formatDate as _formatDate } from './formatLocale';

/**
 * Formats a date string to a human-readable format.
 * Respects the user's active locale via i18next.
 * @param {string|Date} dateString
 * @returns {string}
 */
export const formatDate = (dateString) =>
  _formatDate(dateString, { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Truncates a string to a specified length.
 * @param {string} str 
 * @param {number} num 
 * @returns {string}
 */
export const truncateString = (str, num) => {
  if (str.length <= num) {
    return str;
  }
  return str.slice(0, num) + '...';
};
