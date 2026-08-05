// Shared business logic and utilities for web and mobile
module.exports = {
  formatCurrency: (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  }
};
