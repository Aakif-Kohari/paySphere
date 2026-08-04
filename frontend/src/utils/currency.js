export const getCurrencySymbol = (currencyCode = 'INR') => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  return symbols[currencyCode] || currencyCode;
};

export const formatCurrency = (amount, currencyCode = 'INR') => {
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
};
