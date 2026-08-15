/**
 * @fileoverview Appraisal Controller
 * @description Manages the lifecycle of performance reviews, goal tracking, and scoring.
 * Issue: #983
 */
const {
  AppraisalCycle,
  AppraisalGoal,
  AppraisalReview,
} = require('../models/appraisal.model');
const Employee = require('../models/employee.model');
const {
  calculateFinalScore,
  suggestIncrement,
} = require('../utils/appraisalScorer');
const { tenantFilter } = require('../utils/tenantScope');
const eventBus = require('../services/event.service');

/**
 * POST /api/appraisals/cycles
 * HR creates a new appraisal cycle (e.g., "H1 2026").
 */
exports.createCycle = async (req, res, next) => {
  try {
    const { name, startDate, endDate } = req.body;
    const cycle = await AppraisalCycle.create({
      tenantId: req.tenantId,
      name,
      startDate,
      endDate,
      createdBy: req.userId,
    });
    res.status(201).json({ message: 'Appraisal cycle created', cycle });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/appraisals/goals
 * Manager or Employee adds/updates goals for a specific cycle.
 */
exports.upsertGoals = async (req, res, next) => {
  try {
    const { cycleId, employeeId, goals } = req.body; // goals is an array of {title, weightage, etc.}

    // Validate total weightage equals 100
    const totalWeight = goals.reduce((sum, g) => sum + Number(g.weightage), 0);
    if (totalWeight !== 100) {
      return res
        .status(400)
        .json({
          message: `Total goal weightage must equal 100%. Currently: ${totalWeight}%`,
        });
    }

    // Delete existing goals for this employee/cycle and replace (simplest upsert strategy)
    await AppraisalGoal.deleteMany({
      tenantId: req.tenantId,
      cycleId,
      employeeId,
    });

    const newGoals = goals.map((g) => ({
      tenantId: req.tenantId,
      cycleId,
      employeeId,
      title: g.title,
      description: g.description,
      weightage: g.weightage,
      targetMetric: g.targetMetric,
    }));

    await AppraisalGoal.insertMany(newGoals);

    // Ensure a review document exists in Draft state
    await AppraisalReview.findOneAndUpdate(
      { tenantId: req.tenantId, cycleId, employeeId },
      {
        $setOnInsert: {
          tenantId: req.tenantId,
          cycleId,
          employeeId,
          managerId: req.userId,
          status: 'Draft',
        },
      },
      { upsert: true, new: true },
    );

    res.status(200).json({ message: 'Goals updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appraisals/reviews/:id/self-review
 * Employee submits their self-review ratings and remarks.
 */
exports.submitSelfReview = async (req, res, next) => {
  try {
    // Scoped (#1010). `findById` on a `:id` from the URL let a caller at
    // one company address another company's review.
    const review = await AppraisalReview.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (
      !review ||
      (review.status !== 'Draft' && review.status !== 'Self-Review')
    ) {
      return res
        .status(400)
        .json({ message: 'Review is not in a state to accept self-reviews' });
    }

    const { goalRatings } = req.body; // Array of { goalId, selfAchievement, selfRemarks }

    if (!Array.isArray(goalRatings)) {
      return res.status(400).json({ message: 'goalRatings must be an array' });
    }

    for (const rating of goalRatings) {
      // The goal ids come from the request body, not from the review, so
      // they are as untrusted as the `:id` above — and this one is a
      // *write*. Unscoped, it let a caller edit the achievement figures
      // on any goal in the database by id, in any company, without ever
      // touching a review they were not entitled to.
      //
      // Scoped to the review as well as the tenant: a goal belonging to
      // this company but to a different employee or a different cycle is
      // still not this review's to rate.
      await AppraisalGoal.findOneAndUpdate(
        tenantFilter(req, {
          _id: rating.goalId,
          cycleId: review.cycleId,
          employeeId: review.employeeId,
        }),
        {
          selfAchievement: rating.selfAchievement,
          selfRemarks: rating.selfRemarks,
        },
      );
    }

    review.status = 'Manager-Review';
    await review.save();

    res.status(200).json({ message: 'Self-review submitted to manager' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appraisals/reviews/:id/manager-review
 * Manager submits final ratings, qualitative feedback, and finalizes the review.
 */
exports.submitManagerReview = async (req, res, next) => {
  try {
    // Scoped (#1010), for the same reason as the self-review above. This
    // one carries more: the manager's rating drives `finalScore` and the
    // recommended increment percentage.
    const review = await AppraisalReview.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!review || review.status !== 'Manager-Review') {
      return res
        .status(400)
        .json({ message: 'Review is not pending manager review' });
    }

    const { goalRatings, managerOverallRating, managerQualitativeFeedback } =
      req.body;

    if (!Array.isArray(goalRatings)) {
      return res.status(400).json({ message: 'goalRatings must be an array' });
    }

    // Update manager's rating for each goal
    for (const rating of goalRatings) {
      await AppraisalGoal.findOneAndUpdate(
        tenantFilter(req, {
          _id: rating.goalId,
          cycleId: review.cycleId,
          employeeId: review.employeeId,
        }),
        {
          managerAchievement: rating.managerAchievement,
          managerRemarks: rating.managerRemarks,
        },
      );
    }

    // Fetch updated goals to calculate final score
    const goals = await AppraisalGoal.find(
      tenantFilter(req, {
        cycleId: review.cycleId,
        employeeId: review.employeeId,
      }),
    );

    const finalScore = calculateFinalScore(goals, managerOverallRating);
    const recommendedIncrement = suggestIncrement(finalScore);

    review.managerOverallRating = managerOverallRating;
    review.managerQualitativeFeedback = managerQualitativeFeedback;
    review.finalScore = finalScore;
    review.recommendedIncrementPercent = recommendedIncrement;
    review.status = 'Finalized';
    review.finalizedAt = new Date();

    await review.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'APPRAISAL_FINALIZED',
      resourceType: 'AppraisalReview',
      resourceIds: [review._id],
      details: {
        employeeId: review.employeeId,
        finalScore,
        recommendedIncrement,
      },
      req,
    });

    res.status(200).json({ message: 'Appraisal finalized', review });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appraisals/my-review?cycleId=xxx
 * Employee or Manager fetches the review document and associated goals.
 */
exports.getMyReview = async (req, res, next) => {
  try {
    const { cycleId } = req.query;
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee profile not found' });

    const review = await AppraisalReview.findOne({
      tenantId: req.tenantId,
      cycleId,
      employeeId: employee._id,
    }).populate('managerId', 'fullName');

    const goals = await AppraisalGoal.find({
      tenantId: req.tenantId,
      cycleId,
      employeeId: employee._id,
    });

    res.status(200).json({ review, goals });
  } catch (error) {
    next(error);
  }
};
