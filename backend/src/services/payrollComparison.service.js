const Payroll = require('../models/payroll.model');
const AnomalyConfig = require('../models/anomalyConfig.model');

class PayrollComparisonService {
  /**
   * Compare payrolls for two periods and group into categories.
   *
   * @param {string} tenantId 
   * @param {number} monthA Previous month
   * @param {number} yearA Previous year
   * @param {number} monthB Current month
   * @param {number} yearB Current year
   */
  static async comparePayrolls(tenantId, monthA, yearA, monthB, yearB) {
    // 1. Fetch payroll data for both periods
    const [payrollsA, payrollsB, config] = await Promise.all([
      Payroll.find({ tenantId, month: monthA, year: yearA }).populate('employeeId', 'firstName lastName email status').lean(),
      Payroll.find({ tenantId, month: monthB, year: yearB }).populate('employeeId', 'firstName lastName email status').lean(),
      AnomalyConfig.findOne({ tenantId, isActive: true }).lean()
    ]);

    // Use default config if none found
    const defaultThresholdDrop = config?.netPayDropThresholdPercent || 30;
    const defaultThresholdSpike = config?.netPaySpikeThresholdPercent || 50;

    // Build Maps for quick lookup
    const mapA = new Map(payrollsA.map((p) => [p.employeeId._id.toString(), p]));
    const mapB = new Map(payrollsB.map((p) => [p.employeeId._id.toString(), p]));

    const categories = {
      newHires: [],
      terminations: [],
      leaveVariations: [],
      salaryRevisions: [],
      anomalies: [], // Critical issues requiring review
      allComparisons: [], // Side-by-side details
    };

    const deltaSummary = {
      totalNetPayA: 0,
      totalNetPayB: 0,
      netPayDiff: 0,
    };

    // Helper to calculate percentage difference
    const calcDiffPct = (oldVal, newVal) => {
      if (oldVal === 0 && newVal === 0) return 0;
      if (oldVal === 0) return 100; // or Infinity, but 100 is safer for "spike" check
      return ((newVal - oldVal) / oldVal) * 100;
    };

    // 2. Process all employees present in Period B
    for (const pB of payrollsB) {
      const empIdStr = pB.employeeId._id.toString();
      const pA = mapA.get(empIdStr);
      
      deltaSummary.totalNetPayB += pB.netSalary;
      
      const comparisonRecord = {
        employeeId: pB.employeeId._id,
        employeeName: `${pB.employeeId.firstName || ''} ${pB.employeeId.lastName || ''}`.trim() || pB.employeeName,
        monthA, yearA, monthB, yearB,
        periodA: null,
        periodB: pB,
        diff: null,
        anomalies: [],
      };

      if (!pA) {
        // Employee is in B but not in A -> New Hire (or first payroll)
        categories.newHires.push(comparisonRecord);
        categories.allComparisons.push(comparisonRecord);
        continue;
      }

      // 3. Employee present in both periods - calculate diffs
      deltaSummary.totalNetPayA += pA.netSalary;
      
      const diff = {
        netSalary: pB.netSalary - pA.netSalary,
        netSalaryPct: calcDiffPct(pA.netSalary, pB.netSalary),
        baseSalary: pB.baseSalary - pA.baseSalary,
        leaveDays: (pB.leaveDays || 0) - (pA.leaveDays || 0),
        bonus: (pB.bonus || 0) - (pA.bonus || 0),
        deductions: (pB.deductions || 0) - (pA.deductions || 0),
      };

      comparisonRecord.periodA = pA;
      comparisonRecord.diff = diff;

      // Categorize based on diffs
      if (diff.baseSalary > 0 || diff.baseSalary < 0) {
        categories.salaryRevisions.push(comparisonRecord);
      }
      
      if (diff.leaveDays > 0 || diff.leaveDays < 0) {
         categories.leaveVariations.push(comparisonRecord);
      }

      // 4. Check for Anomalies (configurable rules)
      if (diff.netSalaryPct <= -defaultThresholdDrop) {
        comparisonRecord.anomalies.push({
          type: 'CRITICAL',
          reason: `Net pay dropped by ${Math.abs(diff.netSalaryPct).toFixed(2)}% (Threshold: ${defaultThresholdDrop}%)`
        });
      }
      if (diff.netSalaryPct >= defaultThresholdSpike) {
        comparisonRecord.anomalies.push({
          type: 'WARNING',
          reason: `Net pay spiked by ${diff.netSalaryPct.toFixed(2)}% (Threshold: ${defaultThresholdSpike}%)`
        });
      }

      if (comparisonRecord.anomalies.length > 0) {
        categories.anomalies.push(comparisonRecord);
      }

      categories.allComparisons.push(comparisonRecord);
    }

    // 5. Process Terminations (Present in A, not in B)
    for (const pA of payrollsA) {
      const empIdStr = pA.employeeId._id.toString();
      if (!mapB.has(empIdStr)) {
        deltaSummary.totalNetPayA += pA.netSalary;
        const comparisonRecord = {
          employeeId: pA.employeeId._id,
          employeeName: `${pA.employeeId.firstName || ''} ${pA.employeeId.lastName || ''}`.trim() || pA.employeeName,
          monthA, yearA, monthB, yearB,
          periodA: pA,
          periodB: null,
          diff: null,
          anomalies: []
        };
        categories.terminations.push(comparisonRecord);
        categories.allComparisons.push(comparisonRecord);
      }
    }

    deltaSummary.netPayDiff = deltaSummary.totalNetPayB - deltaSummary.totalNetPayA;

    return {
      deltaSummary,
      categories
    };
  }
}

module.exports = PayrollComparisonService;
