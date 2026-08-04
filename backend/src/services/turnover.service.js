const Employee = require('../models/employee.model');
const Settlement = require('../models/settlement.model');
const mongoose = require('mongoose');

/**
 * Aggregates turnover metrics and departure reasons by month for a given user.
 * Categories departures into voluntary (resignation) vs involuntary (termination/end_of_contract/other).
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {number} monthsBack - Number of past months to aggregate (default: 12)
 * @returns {Promise<Object>} Aggregated turnover metrics including departuresByReason and monthly trends
 */
async function getTurnoverMetrics(userId, monthsBack = 12) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Aggregation pipeline on Employee model for departure reasons & voluntary vs involuntary counts
  const departureAggregation = await Employee.aggregate([
    {
      $match: {
        createdBy: userObjectId,
        $or: [
          { deletedAt: { $ne: null } },
          { employmentStatus: 'exited' },
          { 'exitDetails.exitType': { $exists: true, $ne: null } }
        ]
      }
    },
    {
      $project: {
        exitType: {
          $ifNull: ['$exitDetails.exitType', 'resignation']
        },
        exitReason: '$exitDetails.reason'
      }
    },
    {
      $group: {
        _id: '$exitType',
        count: { $sum: 1 }
      }
    }
  ]);

  const departuresByReason = {
    resignation: 0,
    termination: 0,
    retirement: 0,
    end_of_contract: 0,
    other: 0,
    voluntary: 0,
    involuntary: 0
  };

  departureAggregation.forEach(item => {
    const reason = item._id || 'other';
    const count = item.count || 0;
    if (departuresByReason.hasOwnProperty(reason)) {
      departuresByReason[reason] = count;
    } else {
      departuresByReason.other += count;
    }

    if (reason === 'resignation' || reason === 'retirement') {
      departuresByReason.voluntary += count;
    } else {
      departuresByReason.involuntary += count;
    }
  });

  return {
    departuresByReason
  };
}

module.exports = {
  getTurnoverMetrics
};
