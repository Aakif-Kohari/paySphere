/**
 * @fileoverview Fleet Maintenance & Fuel Anomaly Utilities
 * @description Analyzes trip logs to predict servicing needs and detect fuel theft/inefficiency.
 * Issue: #1206
 */
const { MaintenanceSchedule, TripLog } = require('../models/fleet.model');

/**
 * Checks if a vehicle requires maintenance based on the latest odometer reading.
 * @param {Object} vehicle - The Vehicle document
 * @param {number} currentOdometer - The latest odometer reading
 * @returns {Promise<{needsService: boolean, reason: string}>}
 */
async function checkMaintenanceNeeds(vehicle, currentOdometer) {
    if (currentOdometer >= vehicle.nextServiceOdometer) {
        return {
            needsService: true,
            reason: `Odometer (${currentOdometer} km) has exceeded next service interval (${vehicle.nextServiceOdometer} km).`
        };
    }

    // Check if within 500km of service interval
    if (currentOdometer >= (vehicle.nextServiceOdometer - 500)) {
        return {
            needsService: true,
            reason: `Approaching service interval. Current: ${currentOdometer} km, Due: ${vehicle.nextServiceOdometer} km.`
        };
    }

    return { needsService: false, reason: '' };
}

/**
 * Analyzes fuel efficiency over the last 30 days to detect anomalies.
 * Flags vehicles with abnormal mileage-to-fuel ratios (e.g., < 8 km/liter for petrol).
 * 
 * @param {string} vehicleId 
 * @param {string} tenantId 
 * @returns {Promise<{isAnomaly: boolean, efficiency: number, message: string}>}
 */
async function detectFuelAnomaly(vehicleId, tenantId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await TripLog.find({
        tenantId,
        vehicleId,
        date: { $gte: thirtyDaysAgo },
        fuelAddedLiters: { $gt: 0 }
    });

    if (logs.length < 3) {
        return { isAnomaly: false, efficiency: 0, message: 'Insufficient data for anomaly detection.' };
    }

    let totalDistance = 0;
    let totalFuel = 0;

    for (const log of logs) {
        totalDistance += log.distanceKm;
        totalFuel += log.fuelAddedLiters;
    }

    if (totalFuel === 0) {
        return { isAnomaly: false, efficiency: 0, message: 'No fuel added in the last 30 days.' };
    }

    const efficiency = totalDistance / totalFuel; // km per liter

    // Standard thresholds (can be made configurable per vehicle type later)
    const MIN_EFFICIENCY_PETROL = 10;
    const MIN_EFFICIENCY_DIESEL = 12;

    // Simplified check assuming petrol for this utility
    if (efficiency < MIN_EFFICIENCY_PETROL) {
        return {
            isAnomaly: true,
            efficiency: Math.round(efficiency * 100) / 100,
            message: `Low fuel efficiency detected: ${efficiency.toFixed(2)} km/L (Expected > ${MIN_EFFICIENCY_PETROL} km/L). Possible fuel theft or engine issue.`
        };
    }

    return { isAnomaly: false, efficiency: Math.round(efficiency * 100) / 100, message: 'Fuel efficiency is within normal range.' };
}

module.exports = { checkMaintenanceNeeds, detectFuelAnomaly };
