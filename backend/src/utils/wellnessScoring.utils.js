/**
 * @fileoverview Wellness Scoring & Payroll Injection Engine
 * @description Calculates team leaderboards, normalizes metrics, and determines payroll bonuses.
 * Issue: #1365
 */

/**
 * Normalizes different activity metrics into a standard "Wellness Point" system.
 * @param {string} type - Steps, Distance, Minutes, Calories
 * @param {number} value - Raw metric value
 * @returns {number} Normalized points
 */
function normalizeMetrics(type, value) {
    switch (type) {
        case 'Steps': return value / 100; // 100 steps = 1 point
        case 'Distance': return value * 10; // 1 km = 10 points
        case 'Minutes': return value * 2; // 1 min = 2 points
        case 'Calories': return value / 50; // 50 cals = 1 point
        default: return value;
    }
}

/**
 * Calculates the final leaderboard and determines bonus distribution.
 * @param {Array} teams - Array of TeamRoster documents with populated members
 * @param {number} rewardPool - Total reward pool amount
 * @returns {Array} Sorted leaderboard with bonus allocations
 */
function calculateLeaderboardAndBonuses(teams, rewardPool) {
    const sortedTeams = [...teams].sort((a, b) => b.totalScore - a.totalScore);
    const totalScoreAll = sortedTeams.reduce((sum, t) => sum + t.totalScore, 0);

    return sortedTeams.map((team, index) => {
        let bonusShare = 0;
        if (totalScoreAll > 0 && rewardPool > 0) {
            // Proportional distribution based on score, with a minimum threshold for top 3
            const proportion = team.totalScore / totalScoreAll;
            bonusShare = Math.round(proportion * rewardPool * 100) / 100;

            // Bonus multiplier for top 3 positions
            if (index === 0) bonusShare *= 1.5;
            else if (index === 1) bonusShare *= 1.2;
            else if (index === 2) bonusShare *= 1.1;
        }

        return {
            rank: index + 1,
            teamId: team._id,
            teamName: team.teamName,
            totalScore: team.totalScore,
            memberCount: team.members.length,
            bonusAllocated: Math.round(bonusShare * 100) / 100
        };
    });
}

/**
 * Generates payroll injection payloads for winning team members.
 * @param {Object} leaderboardResult - Result from calculateLeaderboardAndBonuses
 * @param {Array} teams - Full team data with members
 * @returns {Array} Payroll line items to inject
 */
function generatePayrollInjections(leaderboardResult, teams) {
    const injections = [];
    const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

    leaderboardResult.forEach(result => {
        if (result.bonusAllocated <= 0) return;
        const team = teamMap.get(result.teamId.toString());
        if (!team || team.members.length === 0) return;

        const perMemberBonus = result.bonusAllocated / team.members.length;

        team.members.forEach(memberId => {
            injections.push({
                employeeId: memberId,
                componentName: 'Wellness Challenge Bonus',
                amount: Math.round(perMemberBonus * 100) / 100,
                type: 'Earning',
                isTaxable: true,
                description: `Prize for ${result.teamName} (Rank #${result.rank})`
            });
        });
    });

    return injections;
}

module.exports = { normalizeMetrics, calculateLeaderboardAndBonuses, generatePayrollInjections };
