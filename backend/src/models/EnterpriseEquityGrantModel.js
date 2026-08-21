/**
 * Mongoose domain model for Enterprise Equity Compensation & ESOP Management.
 * Tracks stock option grants (ISO, NSO, RSU), vesting schedules (cliff vs graded),
 * strike prices, fair market value (FMV), option exercise events, and SEC/IRS compliance logs.
 */

const mongoose = require('mongoose');

const ExerciseEventSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  exerciseId: { type: String, required: true },
  sharesExercisedCount: { type: Number, required: true },
  exerciseStrikePrice: { type: Number, required: true },
  fairMarketValueAtExercise: { type: Number, required: true },
  totalCostUsd: { type: Number, required: true },
  capitalGainTaxEstimateUsd: { type: Number, required: true },
  exerciseStatus: {
    type: String,
    enum: ['EXECUTED', 'PENDING_PAYMENT', 'CANCELLED'],
    default: 'EXECUTED',
  },
});

const EnterpriseEquityGrantSchema = new mongoose.Schema(
  {
    grantId: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeFullName: { type: String, required: true },
    grantType: {
      type: String,
      enum: ['INCENTIVE_STOCK_OPTION_ISO', 'NON_QUALIFIED_STOCK_OPTION_NSO', 'RESTRICTED_STOCK_UNIT_RSU'],
      required: true,
    },
    totalOptionsGranted: { type: Number, required: true },
    vestedOptionsCount: { type: Number, default: 0 },
    exercisedOptionsCount: { type: Number, default: 0 },
    strikePriceUsd: { type: Number, required: true },
    currentFmvUsd: { type: Number, required: true },
    vestingCliffMonths: { type: Number, default: 12 },
    totalVestingMonths: { type: Number, default: 48 },
    grantDate: { type: Date, default: Date.now },
    exerciseHistory: [ExerciseEventSchema],
    grantStatus: {
      type: String,
      enum: ['ACTIVE_VESTING', 'FULLY_VESTED', 'EXERCISED_OUT', 'FORFEITED'],
      default: 'ACTIVE_VESTING',
    },
    equityAdministratorId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnterpriseEquityGrant', EnterpriseEquityGrantSchema);
