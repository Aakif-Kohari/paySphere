/**
 * @fileoverview Punch Reconciliation & Anomaly Detection Engine
 * @description Pairs raw punch-ins with punch-outs, flags missing punches, 
 * and detects buddy punching/impossible travel based on device IP and timestamps.
 * Issue: #1002
 */

/**
 * Pairs IN and OUT punches for a specific employee on a specific day.
 * 
 * @param {Array} logs - Array of RawPunchLog documents sorted by timestamp
 * @returns {Array} Array of paired shift objects { inTime, outTime, durationMins, anomalies }
 */
function pairPunches(logs) {
    const shifts = [];
    let currentIn = null;

    for (const log of logs) {
        if (log.punchType === 'IN' || (log.punchType === 'UNKNOWN' && !currentIn)) {
            if (currentIn) {
                // Missed OUT punch for the previous IN
                shifts.push({
                    inTime: currentIn.timestamp,
                    outTime: null,
                    durationMins: 0,
                    anomalies: ['Missing OUT Punch'],
                    inDeviceIp: currentIn.deviceIp,
                    outDeviceIp: null
                });
            }
            currentIn = log;
        } else if (log.punchType === 'OUT' || (log.punchType === 'UNKNOWN' && currentIn)) {
            if (currentIn) {
                const durationMins = Math.round((log.timestamp - currentIn.timestamp) / 60000);
                shifts.push({
                    inTime: currentIn.timestamp,
                    outTime: log.timestamp,
                    durationMins,
                    anomalies: [],
                    inDeviceIp: currentIn.deviceIp,
                    outDeviceIp: log.deviceIp
                });
                currentIn = null;
            } else {
                // OUT punch without a preceding IN
                shifts.push({
                    inTime: null,
                    outTime: log.timestamp,
                    durationMins: 0,
                    anomalies: ['Missing IN Punch'],
                    inDeviceIp: null,
                    outDeviceIp: log.deviceIp
                });
            }
        }
    }

    // Handle trailing IN punch without an OUT
    if (currentIn) {
        shifts.push({
            inTime: currentIn.timestamp,
            outTime: null,
            durationMins: 0,
            anomalies: ['Missing OUT Punch (End of Day)'],
            inDeviceIp: currentIn.deviceIp,
            outDeviceIp: null
        });
    }

    return shifts;
}

/**
 * Detects "Buddy Punching" or impossible travel.
 * If an employee punches IN on Device A, and 5 minutes later punches IN on Device B 
 * (which is physically far away or has a different IP), flag it.
 * 
 * @param {Array} logs - All raw logs for an employee across a day
 * @returns {Array} Array of anomaly descriptions
 */
function detectBuddyPunching(logs) {
    const anomalies = [];
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (let i = 1; i < sortedLogs.length; i++) {
        const prev = sortedLogs[i - 1];
        const curr = sortedLogs[i];

        // If two IN punches happen on different IPs within 15 minutes
        if (
            prev.punchType === 'IN' &&
            curr.punchType === 'IN' &&
            prev.deviceIp !== curr.deviceIp
        ) {
            const timeDiffMins = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 60000;
            if (timeDiffMins < 15) {
                anomalies.push(
                    `Buddy Punching Suspected: IN on ${prev.deviceIp} and IN on ${curr.deviceIp} within ${Math.round(timeDiffMins)} minutes.`
                );
            }
        }
    }

    return anomalies;
}

/**
 * Main reconciliation function for a specific employee on a specific day.
 * @param {Array} rawLogs 
 * @returns {{ shifts: Array, globalAnomalies: Array, isClean: boolean }}
 */
function reconcileEmployeeDay(rawLogs) {
    const shifts = pairPunches(rawLogs);
    const globalAnomalies = detectBuddyPunching(rawLogs);

    // Inject global anomalies into the relevant shifts
    if (globalAnomalies.length > 0 && shifts.length > 0) {
        shifts[0].anomalies = [...shifts[0].anomalies, ...globalAnomalies];
    }

    const hasAnomalies = shifts.some(s => s.anomalies.length > 0) || globalAnomalies.length > 0;

    return {
        shifts,
        globalAnomalies,
        isClean: !hasAnomalies
    };
}

module.exports = { pairPunches, detectBuddyPunching, reconcileEmployeeDay };
