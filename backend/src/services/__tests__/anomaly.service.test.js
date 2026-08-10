'use strict';

const AnomalyService = require('../anomaly.service');

describe('AnomalyService', () => {
  describe('detectAnomalies', () => {
    it('should return empty report when payrolls array is empty', () => {
      const report = AnomalyService.detectAnomalies([]);
      expect(report.totalPayrollsAnalyzed).toBe(0);
      expect(report.anomalyCount).toBe(0);
      expect(report.hasCriticalAnomalies).toBe(false);
    });

    it('should detect CRITICAL severity for duplicate bank account across different employees', () => {
      const payrolls = [
        { _id: 'p1', employeeId: 'emp1', employeeName: 'Alice', bankAccountNumber: 'ACC123456', netSalary: 5000 },
        { _id: 'p2', employeeId: 'emp2', employeeName: 'Bob', bankAccountNumber: 'ACC123456', netSalary: 5200 },
      ];

      const report = AnomalyService.detectAnomalies(payrolls);
      expect(report.hasCriticalAnomalies).toBe(true);
      expect(report.severityDistribution.CRITICAL).toBe(2);

      const duplicateAnomalies = report.anomalies.filter((a) => a.type === 'DUPLICATE_BANK_ACCOUNT');
      expect(duplicateAnomalies.length).toBe(2);
      expect(duplicateAnomalies[0].severity).toBe('CRITICAL');
    });

    it('should detect statistical Z-score outliers (> 3 std dev)', () => {
      const payrolls = [
        { _id: 'p1', employeeId: 'emp1', netSalary: 5000 },
        { _id: 'p2', employeeId: 'emp2', netSalary: 5100 },
        { _id: 'p3', employeeId: 'emp3', netSalary: 4900 },
        { _id: 'p4', employeeId: 'emp4', netSalary: 5050 },
        { _id: 'p5', employeeId: 'emp5', netSalary: 5020 },
        { _id: 'p6', employeeId: 'emp6', netSalary: 4980 },
        { _id: 'p7', employeeId: 'emp7', netSalary: 5010 },
        { _id: 'p8', employeeId: 'emp8', netSalary: 5030 },
        { _id: 'p9', employeeId: 'emp9', netSalary: 55000 }, // Outlier
      ];

      const report = AnomalyService.detectAnomalies(payrolls);
      const zOutliers = report.anomalies.filter((a) => a.type === 'STATISTICAL_ZSCORE_OUTLIER');
      expect(zOutliers.length).toBeGreaterThan(0);
      expect(zOutliers[0].employeeId).toBe('emp9');
    });

    it('should detect historical salary spike (> 30% increase over 6-month baseline)', () => {
      const currentPayrolls = [
        { _id: 'p1', employeeId: 'emp1', employeeName: 'Charlie', netSalary: 13000 },
      ];
      const historicalPayrolls = [
        { employeeId: 'emp1', netSalary: 9000 },
        { employeeId: 'emp1', netSalary: 9100 },
        { employeeId: 'emp1', netSalary: 8900 },
      ];

      const report = AnomalyService.detectAnomalies(currentPayrolls, historicalPayrolls);
      const spikes = report.anomalies.filter((a) => a.type === 'HISTORICAL_SALARY_SPIKE');
      expect(spikes.length).toBe(1);
      expect(spikes[0].employeeId).toBe('emp1');
      expect(spikes[0].details.percentIncrease).toBeGreaterThanOrEqual(30);
    });

    it('should detect excessive bonus ratios (> 50% of base salary)', () => {
      const payrolls = [
        { _id: 'p1', employeeId: 'emp1', baseSalary: 5000, bonus: 4000, netSalary: 9000 },
      ];

      const report = AnomalyService.detectAnomalies(payrolls);
      const bonusAnomalies = report.anomalies.filter((a) => a.type === 'EXCESSIVE_BONUS_RATIO');
      expect(bonusAnomalies.length).toBe(1);
      expect(bonusAnomalies[0].details.ratio).toBe(0.8);
    });
  });

  describe('detect legacy wrapper', () => {
    it('should filter payroll items exceeding 50,000 threshold or flagged anomalies', () => {
      const payrolls = [
        { _id: 'p1', employeeId: 'emp1', netSalary: 60000 },
        { _id: 'p2', employeeId: 'emp2', netSalary: 4000 },
      ];

      const result = AnomalyService.detect(payrolls);
      expect(result.length).toBe(1);
      expect(result[0]._id).toBe('p1');
    });
  });
});
