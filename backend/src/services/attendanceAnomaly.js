const { RawPunchLog, BiometricDevice } = require('../models/biometric.model');
const Employee = require('../models/employee.model');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Calculates distance between two coordinates using the Haversine formula.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // Radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Scans punch logs chronologically to flag geographic velocity anomalies and proxy punches.
 * Sends email regularization alert if anomaly validation fails.
 * 
 * @param {object} currentPunchLog - The raw punch document
 * @returns {Promise<boolean>} True if anomaly was detected
 */
async function detectAnomalyAndAlert(currentPunchLog) {
  try {
    // 1. Fetch previous punch log chronologically
    const previousPunch = await RawPunchLog.findOne({
      tenantId: currentPunchLog.tenantId,
      externalEmployeeId: currentPunchLog.externalEmployeeId,
      timestamp: { $lt: currentPunchLog.timestamp },
      status: { $ne: 'Ignored' }
    }).sort({ timestamp: -1 });

    if (!previousPunch) return false;

    // 2. Resolve devices
    const currentDevice = await BiometricDevice.findById(currentPunchLog.deviceId);
    const previousDevice = await BiometricDevice.findById(previousPunch.deviceId);

    if (!currentDevice || !previousDevice) return false;

    // 3. Compute distance and time differences
    const lat1 = currentDevice.latitude || 0;
    const lon1 = currentDevice.longitude || 0;
    const lat2 = previousDevice.latitude || 0;
    const lon2 = previousDevice.longitude || 0;

    const distance = haversineDistance(lat1, lon1, lat2, lon2);
    const timeDiffMs = Math.abs(new Date(currentPunchLog.timestamp) - new Date(previousPunch.timestamp));
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    let isAnomaly = false;
    const anomalyFlags = [];

    // Velocity anomaly check: impossible travel (exceeding 150 km/h)
    if (distance > 0 && timeDiffHours > 0) {
      const speed = distance / timeDiffHours;
      if (speed > 150) {
        isAnomaly = true;
        anomalyFlags.push('Impossible Travel');
      }
    }

    // Proxy punching check: different device within 1 minute
    if (String(currentPunchLog.deviceId) !== String(previousPunch.deviceId) && timeDiffMs < 60000) {
      isAnomaly = true;
      anomalyFlags.push('Proxy Punching Suspected');
    }

    if (isAnomaly) {
      currentPunchLog.status = 'Flagged';
      currentPunchLog.anomalyFlags = anomalyFlags;
      await currentPunchLog.save();

      // Find the employee matching this device badge external id
      const employee = await Employee.findOne({
        tenantId: currentPunchLog.tenantId,
        $or: [
          { biometricId: currentPunchLog.externalEmployeeId },
          { employeeCode: currentPunchLog.externalEmployeeId },
          { _id: mongoose.Types.ObjectId.isValid(currentPunchLog.externalEmployeeId) ? currentPunchLog.externalEmployeeId : null }
        ]
      });

      if (employee && employee.email) {
        try {
          await sendEmail({
            to: employee.email,
            subject: 'Urgent: Biometric Punch Anomaly Detected - Regularization Required',
            text: `Hello ${employee.fullName},\n\nOur system detected an anomaly with your recent biometric punch on ${currentPunchLog.timestamp.toLocaleString()}.\nReason: ${anomalyFlags.join(', ')}.\n\nPlease submit a regularization request as soon as possible to avoid payroll adjustment penalties.\n\nBest Regards,\nPaySphere Team`,
          });
          logger.info(`Regularization alert sent to employee ${employee.email}`);
        } catch (err) {
          logger.error('Failed to send regularization email alert', { error: err.message });
        }
      }
    }

    return isAnomaly;
  } catch (error) {
    logger.error('Error during biometric anomaly detection', { error: error.message });
    return false;
  }
}

module.exports = {
  detectAnomalyAndAlert,
  haversineDistance
};
