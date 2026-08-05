const getCurrencySymbol = (currencyCode = 'INR') => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  return symbols[currencyCode] || currencyCode;
};

const formatCurrency = (amount, currencyCode = 'INR') => {
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
};

module.exports = {
  getCurrencySymbol,
  formatCurrency
};
