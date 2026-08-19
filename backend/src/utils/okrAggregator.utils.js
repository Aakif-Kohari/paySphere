/**
 * @fileoverview OKR Aggregation Engine
 * @description Recursively calculates parent objective progress based on the 
 * weighted average of child Key Results or child Objectives.
 * Issue: #1168
 */
const { Objective } = require('../models/okr.model');

/**
 * Calculates the progress percentage of a single Key Result.
 * @param {Object} kr - Key Result object
 * @returns {number} Progress (0-100)
 */
function calculateKRProgress(kr) {
    if (kr.metricType === 'Boolean') {
        return kr.currentValue >= 1 ? 100 : 0;
    }
    if (kr.targetValue === 0) return 0;

    const progress = (kr.currentValue / kr.targetValue) * 100;
    return Math.min(Math.max(Math.round(progress), 0), 100); // Clamp between 0 and 100
}

/**
 * Recursively updates the progress of an objective and all its ancestors.
 * 
 * @param {string} objectiveId - The ID of the objective to recalculate
 * @param {string} tenantId 
 */
async function cascadeProgressUpdate(objectiveId, tenantId) {
    const objective = await Objective.findOne({ _id: objectiveId, tenantId });
    if (!objective) return;

    // 1. Calculate progress from direct Key Results
    let krProgressSum = 0;
    let krCount = objective.keyResults.length;

    for (const kr of objective.keyResults) {
        kr.progressPercent = calculateKRProgress(kr);
        krProgressSum += kr.progressPercent;
    }

    const krAverage = krCount > 0 ? krProgressSum / krCount : 0;

    // 2. Calculate progress from Child Objectives (if cascaded)
    const childObjectives = await Objective.find({ parentId: objectiveId, tenantId });
    let childProgressSum = 0;
    let childCount = childObjectives.length;

    for (const child of childObjectives) {
        childProgressSum += child.overallProgress;
    }

    const childAverage = childCount > 0 ? childProgressSum / childCount : 0;

    // 3. Combine KR progress and Child Objective progress (50/50 weight if both exist, else 100% of whichever exists)
    let finalProgress = 0;
    if (krCount > 0 && childCount > 0) {
        finalProgress = (krAverage + childAverage) / 2;
    } else if (krCount > 0) {
        finalProgress = krAverage;
    } else if (childCount > 0) {
        finalProgress = childAverage;
    }

    // 4. Update status based on progress
    let status = 'On Track';
    if (finalProgress >= 100) status = 'Completed';
    else if (finalProgress < 30) status = 'Off Track';
    else if (finalProgress < 60) status = 'At Risk';

    objective.overallProgress = Math.round(finalProgress);
    objective.status = status;
    await objective.save();

    // 5. Recursively cascade up to the parent
    if (objective.parentId) {
        await cascadeProgressUpdate(objective.parentId, tenantId);
    }
}

module.exports = { cascadeProgressUpdate, calculateKRProgress };
