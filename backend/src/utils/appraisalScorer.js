/**
 * @fileoverview Appraisal Scoring Engine
 * @description Calculates the weighted final score based on goal achievement (70%)
 * and qualitative manager rating (30%).
 * Issue: #983
 */

/**
 * Calculates the weighted goal achievement score.
 * Formula: Sum of (Goal Weightage * Manager Achievement %) / 100
 * 
 * @param {Array} goals - Array of AppraisalGoal documents
 * @returns {number} Weighted goal score (0-100)
 */
function calculateGoalScore(goals) {
    if (!goals || goals.length === 0) return 0;

    let totalWeightage = 0;
    let weightedSum = 0;

    for (const goal of goals) {
        totalWeightage += goal.weightage;
        // Use manager's rating if available, otherwise fall back to self-rating for drafts
        const achievement = goal.managerAchievement > 0 ? goal.managerAchievement : goal.selfAchievement;
        weightedSum += (goal.weightage * achievement);
    }

    // Prevent division by zero if weightages don't sum to 100 (though they should)
    if (totalWeightage === 0) return 0;

    return Math.round((weightedSum / totalWeightage) * 100) / 100;
}

/**
 * Calculates the final composite appraisal score.
 * Weights: 70% Goal Achievement, 30% Manager Qualitative Rating.
 * 
 * @param {Array} goals - Array of AppraisalGoal documents
 * @param {number} managerRating - Manager's qualitative rating (0 to 5)
 * @param {number} maxManagerRating - The maximum possible manager rating (default 5)
 * @returns {number} Final composite score (0-100)
 */
function calculateFinalScore(goals, managerRating, maxManagerRating = 5) {
    const goalScore = calculateGoalScore(goals);

    // Normalize manager rating to a 0-100 scale
    const normalizedManagerScore = (managerRating / maxManagerRating) * 100;

    // Apply weights: 70% goals, 30% qualitative
    const finalScore = (goalScore * 0.70) + (normalizedManagerScore * 0.30);

    return Math.round(finalScore * 100) / 100;
}

/**
 * Suggests an increment percentage based on the final composite score.
 * This is a basic bell-curve mapping; real-world apps might use complex matrices.
 * 
 * @param {number} finalScore - The 0-100 composite score
 * @returns {number} Recommended increment percentage
 */
function suggestIncrement(finalScore) {
    if (finalScore >= 90) return 15; // Exceptional
    if (finalScore >= 80) return 12; // Exceeds Expectations
    if (finalScore >= 70) return 8;  // Meets Expectations
    if (finalScore >= 60) return 4;  // Needs Improvement
    return 0;                        // Underperformer (No increment / PIP)
}

module.exports = { calculateGoalScore, calculateFinalScore, suggestIncrement };
