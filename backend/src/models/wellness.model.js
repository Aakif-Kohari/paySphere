/**
 * @fileoverview Wellness Challenge & Activity Schemas
 * @description Manages corporate wellness challenges, team rosters, and daily activity logs.
 * Issue: #1365
 */
const mongoose = require('mongoose');

const wellnessChallengeSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['Steps', 'Distance', 'Minutes', 'Calories'], default: 'Steps' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    targetGoal: { type: Number, required: true },
    rewardPoolAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['Upcoming', 'Active', 'Completed', 'Cancelled'], default: 'Upcoming' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const teamRosterSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WellnessChallenge', required: true },
    teamName: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    totalScore: { type: Number, default: 0 }
}, { timestamps: true });

const activityLogSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WellnessChallenge', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamRoster', required: true },
    date: { type: Date, required: true },
    metricValue: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['Manual', 'Fitbit', 'AppleHealth', 'GoogleFit'], default: 'Manual' },
    isVerified: { type: Boolean, default: false }
}, { timestamps: true });

activityLogSchema.index({ challengeId: 1, employeeId: 1, date: 1 }, { unique: true });
const WellnessChallenge = mongoose.model('WellnessChallenge', wellnessChallengeSchema);
const TeamRoster = mongoose.model('TeamRoster', teamRosterSchema);
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = { WellnessChallenge, TeamRoster, ActivityLog };
