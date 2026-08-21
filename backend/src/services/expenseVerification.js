const ExpenseClaim = require('../models/expenseClaim.model');
const { ExpensePolicy } = require('../models/expensePolicy.model');
const ExpenseCategory = require('../models/expenseCategory.model');

/**
 * Validates an expense claim against duplicate receipts, OCR details, and policy limits.
 * 
 * @param {object} claim - The Mongoose ExpenseClaim document or object
 * @returns {Promise<object>} The updated claim object with fraud flags
 */
async function verifyExpenseClaim(claim) {
  const ocrMetadata = claim.ocrMetadata || {};
  let isPossibleFraud = false;
  let fraudDetails = '';

  // 1. Duplicate check (Image Hash)
  if (claim.imageHash) {
    const duplicate = await ExpenseClaim.findOne({
      tenantId: claim.tenantId,
      imageHash: claim.imageHash,
      _id: { $ne: claim._id }
    });
    if (duplicate) {
      isPossibleFraud = true;
      fraudDetails += `Duplicate receipt detected (matches claim ${duplicate._id}). `;
    }
  }

  // 2. OCR mismatches
  let amountMatches = true;
  let dateMatches = true;
  let currencyMatches = true;

  if (ocrMetadata.extractedAmount !== undefined && ocrMetadata.extractedAmount !== null) {
    if (Math.abs(claim.amount - ocrMetadata.extractedAmount) > 0.01) {
      amountMatches = false;
      isPossibleFraud = true;
      fraudDetails += `OCR amount mismatch: claimed ${claim.amount}, extracted ${ocrMetadata.extractedAmount}. `;
    }
  }

  if (ocrMetadata.extractedDate !== undefined && ocrMetadata.extractedDate !== null) {
    const claimDate = new Date(claim.expenseDate).toDateString();
    const extractedDate = new Date(ocrMetadata.extractedDate).toDateString();
    if (claimDate !== extractedDate) {
      dateMatches = false;
      isPossibleFraud = true;
      fraudDetails += `OCR date mismatch: claimed ${claimDate}, extracted ${extractedDate}. `;
    }
  }

  if (ocrMetadata.extractedCurrency !== undefined && ocrMetadata.extractedCurrency !== null) {
    if (claim.currency.toUpperCase() !== ocrMetadata.extractedCurrency.toUpperCase()) {
      currencyMatches = false;
      isPossibleFraud = true;
      fraudDetails += `OCR currency mismatch: claimed ${claim.currency}, extracted ${ocrMetadata.extractedCurrency}. `;
    }
  }

  // 3. Monthly Policy Limits
  const policy = await ExpensePolicy.findOne({ tenantId: claim.tenantId });
  if (policy) {
    const categoryDoc = await ExpenseCategory.findById(claim.categoryId);
    const categoryName = categoryDoc ? categoryDoc.name : '';

    const categoryLimit = policy.categories.find(c => c.category === categoryName);
    if (categoryLimit) {
      // Check maxLimitPerClaim
      if (categoryLimit.maxLimitPerClaim && claim.amount > categoryLimit.maxLimitPerClaim) {
        isPossibleFraud = true;
        fraudDetails += `Claim amount ${claim.amount} exceeds category limit per claim of ${categoryLimit.maxLimitPerClaim}. `;
      }

      // Check maxLimitPerMonth
      if (categoryLimit.maxLimitPerMonth && categoryLimit.maxLimitPerMonth > 0) {
        const startOfMonth = new Date(claim.expenseDate);
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        const monthlyClaims = await ExpenseClaim.find({
          tenantId: claim.tenantId,
          employeeId: claim.employeeId,
          categoryId: claim.categoryId,
          status: { $in: ['approved', 'pending_approval', 'reimbursed'] },
          expenseDate: { $gte: startOfMonth, $lt: endOfMonth },
          _id: { $ne: claim._id }
        });

        const totalSpent = monthlyClaims.reduce((sum, c) => sum + c.amount, 0);
        if (totalSpent + claim.amount > categoryLimit.maxLimitPerMonth) {
          isPossibleFraud = true;
          fraudDetails += `Monthly cumulative spend would be ${totalSpent + claim.amount}, exceeding category limit of ${categoryLimit.maxLimitPerMonth} per month. `;
        }
      }
    }
  }

  claim.isPossibleFraud = isPossibleFraud;
  claim.fraudDetails = fraudDetails.trim();
  claim.ocrMetadata = {
    ...claim.ocrMetadata,
    amountMatches,
    dateMatches,
    currencyMatches
  };

  return claim;
}

module.exports = {
  verifyExpenseClaim
};
