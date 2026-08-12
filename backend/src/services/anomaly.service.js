/**
 * @fileoverview ML & Statistical Payroll Anomaly Detection Engine
 * @description Provides multi-factorial statistical analysis (Z-Score, IQR, duplicate bank detection,
 * historical salary spike analysis) to identify suspicious or invalid payroll entries before finalization.
 */

'use strict';

const logger = require('../utils/logger');

/**
 * Severity constants for flagged payroll anomalies.
 */
const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

class AnomalyService {
  /**
   * Calculate mean of a numerical dataset.
   * @param {number[]} values
   * @returns {number}
   */
  static _mean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate sample standard deviation of a dataset.
   * @param {number[]} values
   * @param {number} meanVal
   * @returns {number}
   */
  static _stdDev(values, meanVal) {
    if (!values || values.length < 2) return 0;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - meanVal, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile of a sorted dataset using linear interpolation.
   * @param {number[]} sortedValues
   * @param {number} p (0 to 1)
   * @returns {number}
   */
  static _percentile(sortedValues, p) {
    if (!sortedValues || sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];
    const index = p * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Main entry point for payroll anomaly detection.
   *
   * @param {Array<object>} payrolls Current payroll run items
   * @param {Array<object>} [historicalPayrolls=[]] Previous 6-month payroll records for baseline comparison
   * @returns {object} Anomaly detection report with severity metrics and flagged records
   */
  static detectAnomalies(payrolls = [], historicalPayrolls = []) {
    logger.info('Executing payroll anomaly detection engine', {
      itemCount: payrolls.length,
      historyCount: historicalPayrolls.length,
    });

    if (!Array.isArray(payrolls) || payrolls.length === 0) {
      return {
        totalPayrollsAnalyzed: 0,
        anomalyCount: 0,
        hasCriticalAnomalies: false,
        severityDistribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        anomalies: [],
      };
    }

    const anomalies = [];

    // Extract numerical series for net salaries & bonuses across current batch
    const netSalaries = payrolls
      .map((p) => Number(p.netSalary) || 0)
      .filter((val) => !isNaN(val));

    const meanSalary = this._mean(netSalaries);
    const stdDevSalary = this._stdDev(netSalaries, meanSalary);

    // IQR Calculation
    const sortedSalaries = [...netSalaries].sort((a, b) => a - b);
    const q1 = this._percentile(sortedSalaries, 0.25);
    const q3 = this._percentile(sortedSalaries, 0.75);
    const iqr = q3 - q1;
    const iqrUpperFence = q3 + 1.5 * iqr;
    const iqrLowerFence = Math.max(0, q1 - 1.5 * iqr);

    // Track bank accounts to detect duplicates across different employees
    const bankAccountMap = new Map();
    for (const p of payrolls) {
      const bankAcc = p.bankAccountNumber || p.iban || (p.employee && p.employee.bankAccountNumber);
      const empId = String(p.employeeId || (p.employee && p.employee._id) || 'unknown');

      if (bankAcc && bankAcc.trim() !== '') {
        const key = bankAcc.trim();
        if (!bankAccountMap.has(key)) {
          bankAccountMap.set(key, []);
        }
        bankAccountMap.get(key).push({ payrollId: p._id, employeeId: empId, name: p.employeeName || p.name });
      }
    }

    // Process duplicate bank account flags (CRITICAL severity)
    for (const [bankAcc, occurrences] of bankAccountMap.entries()) {
      if (occurrences.length > 1) {
        const empIds = [...new Set(occurrences.map((o) => o.employeeId))];
        if (empIds.length > 1) {
          for (const occ of occurrences) {
            anomalies.push({
              payrollId: occ.payrollId,
              employeeId: occ.employeeId,
              employeeName: occ.name,
              type: 'DUPLICATE_BANK_ACCOUNT',
              severity: SEVERITY.CRITICAL,
              score: 1.0,
              message: `Bank account ${bankAcc} is shared across multiple employees (${empIds.join(', ')}). Potential fraud risk.`,
              details: { bankAccount: bankAcc, sharedWithEmployeeIds: empIds },
            });
          }
        }
      }
    }

    // Map historical salaries by employee ID for baseline comparisons
    const historyByEmployee = new Map();
    for (const hp of historicalPayrolls) {
      const empId = String(hp.employeeId || (hp.employee && hp.employee._id) || '');
      if (empId) {
        if (!historyByEmployee.has(empId)) {
          historyByEmployee.set(empId, []);
        }
        const sal = Number(hp.netSalary) || 0;
        if (sal > 0) historyByEmployee.get(empId).push(sal);
      }
    }

    // Evaluate individual payroll records
    for (const p of payrolls) {
      const empId = String(p.employeeId || (p.employee && p.employee._id) || '');
      const netSal = Number(p.netSalary) || 0;
      const bonus = Number(p.bonus) || Number(p.allowances) || 0;

      // 1. Z-Score Outlier Check
      if (stdDevSalary > 0) {
        const zScore = Math.abs((netSal - meanSalary) / stdDevSalary);
        if (zScore >= 3.0) {
          anomalies.push({
            payrollId: p._id,
            employeeId: empId,
            employeeName: p.employeeName || p.name,
            type: 'STATISTICAL_ZSCORE_OUTLIER',
            severity: zScore >= 4.0 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
            score: Math.min(1.0, zScore / 5.0),
            message: `Net salary (${netSal}) deviates by ${zScore.toFixed(2)} standard deviations from batch mean (${meanSalary.toFixed(2)}).`,
            details: { netSalary: netSal, meanSalary, zScore: Number(zScore.toFixed(2)) },
          });
        }
      }

      // 2. IQR Fence Check
      if (iqr > 0 && netSal > iqrUpperFence) {
        anomalies.push({
          payrollId: p._id,
          employeeId: empId,
          employeeName: p.employeeName || p.name,
          type: 'IQR_UPPER_FENCE_OUTLIER',
          severity: SEVERITY.MEDIUM,
          score: Math.min(1.0, (netSal - iqrUpperFence) / iqr),
          message: `Net salary (${netSal}) exceeds IQR upper fence (${iqrUpperFence.toFixed(2)}).`,
          details: { netSalary: netSal, q1, q3, iqr, upperFence: iqrUpperFence },
        });
      }

      // 3. Historical Salary Spike Check (> 30% increase)
      if (empId && historyByEmployee.has(empId)) {
        const empHistory = historyByEmployee.get(empId);
        if (empHistory.length > 0) {
          const historicalAvg = this._mean(empHistory);
          if (historicalAvg > 0) {
            const pctChange = (netSal - historicalAvg) / historicalAvg;
            if (pctChange >= 0.30) {
              const severity = pctChange >= 0.50 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
              anomalies.push({
                payrollId: p._id,
                employeeId: empId,
                employeeName: p.employeeName || p.name,
                type: 'HISTORICAL_SALARY_SPIKE',
                severity,
                score: Math.min(1.0, pctChange),
                message: `Net salary (${netSal}) is ${(pctChange * 100).toFixed(1)}% higher than 6-month baseline average (${historicalAvg.toFixed(2)}).`,
                details: { netSalary: netSal, historicalAvg, percentIncrease: Number((pctChange * 100).toFixed(1)) },
              });
            }
          }
        }
      }

      // 4. Excessive Bonus Check (Bonus > 50% of Base Salary)
      const baseSalary = Number(p.baseSalary) || Number(p.grossSalary) || netSal;
      if (baseSalary > 0 && bonus > 0.5 * baseSalary) {
        anomalies.push({
          payrollId: p._id,
          employeeId: empId,
          employeeName: p.employeeName || p.name,
          type: 'EXCESSIVE_BONUS_RATIO',
          severity: SEVERITY.MEDIUM,
          score: Math.min(1.0, bonus / baseSalary),
          message: `Bonus/Allowance payout (${bonus}) is over 50% of base salary (${baseSalary}).`,
          details: { bonus, baseSalary, ratio: Number((bonus / baseSalary).toFixed(2)) },
        });
      }
    }

    const severityDistribution = {
      CRITICAL: anomalies.filter((a) => a.severity === SEVERITY.CRITICAL).length,
      HIGH: anomalies.filter((a) => a.severity === SEVERITY.HIGH).length,
      MEDIUM: anomalies.filter((a) => a.severity === SEVERITY.MEDIUM).length,
      LOW: anomalies.filter((a) => a.severity === SEVERITY.LOW).length,
    };

    return {
      totalPayrollsAnalyzed: payrolls.length,
      anomalyCount: anomalies.length,
      hasCriticalAnomalies: severityDistribution.CRITICAL > 0,
      severityDistribution,
      anomalies,
    };
  }

  /**
   * Backward-compatible legacy interface wrapper.
   * Filters payroll items exceeding basic threshold or statistical flags.
   *
   * @param {Array<object>} payrolls
   * @returns {Array<object>}
   */
  static detect(payrolls) {
    if (!Array.isArray(payrolls)) return [];
    const report = this.detectAnomalies(payrolls);
    const flaggedIds = new Set(report.anomalies.map((a) => String(a.payrollId)));
    return payrolls.filter((p) => flaggedIds.has(String(p._id)) || Number(p.netSalary) > 50000);
  }
}

module.exports = AnomalyService;
