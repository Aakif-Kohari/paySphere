/**
 * @fileoverview Geospatial Utilities
 * @description Haversine formula, speed calculations, and GPS drift heuristics.
 * Issue: #930
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the distance between two GPS coordinates using the Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = (val) => (val * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates the speed of travel between two points in km/h.
 * Used to detect GPS spoofing (e.g., teleporting or impossible driving speeds).
 * @param {number} distanceMeters 
 * @param {Date} time1 
 * @param {Date} time2 
 * @returns {number} Speed in km/h
 */
function calculateSpeedKmh(distanceMeters, time1, time2) {
    const timeDiffSeconds = Math.abs((time2 - time1) / 1000);
    if (timeDiffSeconds === 0) return Infinity;
    const distanceKm = distanceMeters / 1000;
    const timeDiffHours = timeDiffSeconds / 3600;
    return distanceKm / timeDiffHours;
}

/**
 * Checks if a speed exceeds humanly possible travel (e.g., > 300 km/h).
 * @param {number} speedKmh 
 * @returns {boolean}
 */
function isImpossibleSpeed(speedKmh) {
    return speedKmh > 300; // Commercial jet speed threshold
}

module.exports = { getDistanceMeters, calculateSpeedKmh, isImpossibleSpeed };
