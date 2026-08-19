'use strict';

const {
  generateAccessRevocationChecklist,
  calculateClearanceScore,
  calculateAssetRecoveryDeductions,
  checkFnFBlock,
  buildClearanceCertificate,
} = require('../handoverEngine.utils');

describe('Offboarding Handover & Clearance Engine', () => {
  describe('generateAccessRevocationChecklist', () => {
    it('generates IT engineering access items for Engineering department', () => {
      const checklist = generateAccessRevocationChecklist('Engineering', 'Senior Developer');
      expect(checklist.some((c) => c.systemName.includes('GitHub'))).toBe(true);
      expect(checklist.some((c) => c.systemName.includes('AWS'))).toBe(true);
      expect(checklist.some((c) => c.systemName.includes('HRMS'))).toBe(true);
    });
  });

  describe('calculateClearanceScore', () => {
    it('computes 100% when all mandatory KTs, assets, and accesses are resolved', () => {
      const plan = {
        knowledgeTransfers: [{ isMandatory: true, isCompleted: true }],
        assetRecoveries: [{ condition: 'Returned Good' }],
        accessRevocations: [{ isRevoked: true }],
      };

      expect(calculateClearanceScore(plan)).toBe(100);
    });

    it('calculates weighted partial scores accurately (40% KT, 40% Asset, 20% IT Access)', () => {
      const plan = {
        knowledgeTransfers: [
          { isMandatory: true, isCompleted: true },
          { isMandatory: true, isCompleted: false }, // 1/2 = 20 pts
        ],
        assetRecoveries: [
          { condition: 'Returned Good' }, // 1/1 = 40 pts
        ],
        accessRevocations: [
          { isRevoked: false }, // 0/1 = 0 pts
        ],
      };

      expect(calculateClearanceScore(plan)).toBe(60); // 20 + 40 + 0 = 60
    });
  });

  describe('calculateAssetRecoveryDeductions', () => {
    it('aggregates deductions for damaged or lost company assets', () => {
      const recoveries = [
        { assetName: 'Laptop', condition: 'Returned Damaged', payrollDeduction: 5000 },
        { assetName: 'Access Badge', condition: 'Lost', payrollDeduction: 500 },
        { assetName: 'Monitor', condition: 'Returned Good', payrollDeduction: 0 },
      ];

      const result = calculateAssetRecoveryDeductions(recoveries);
      expect(result.totalDeductions).toBe(5500);
      expect(result.deductionsBreakdown).toHaveLength(2);
    });
  });

  describe('checkFnFBlock & buildClearanceCertificate', () => {
    it('blocks FnF settlement when clearance score is under 100%', () => {
      const plan = {
        knowledgeTransfers: [{ isMandatory: true, isCompleted: false }],
        assetRecoveries: [],
        accessRevocations: [],
      };

      const block = checkFnFBlock(plan, 50);
      expect(block.isBlocked).toBe(true);
      expect(block.reason).toContain('below 100%');
    });

    it('generates digital clearance certificate when fully signed off', () => {
      const plan = {
        _id: '64a1b2c3d4e5f6a7b8c9d0e1',
        employeeId: 'emp-1',
        exitDate: new Date('2026-08-31'),
        knowledgeTransfers: [{ isMandatory: true, isCompleted: true }],
        assetRecoveries: [{ condition: 'Returned Good', payrollDeduction: 0 }],
        accessRevocations: [{ isRevoked: true }],
        managerSignOff: true,
        managerSignOffDate: new Date(),
        itSignOff: true,
        itSignOffDate: new Date(),
      };

      const employee = { _id: 'emp-1', fullName: 'John Doe', department: 'Engineering' };
      const cert = buildClearanceCertificate(plan, employee);

      expect(cert.certificateNumber).toContain('CERT-EXIT-');
      expect(cert.employeeName).toBe('John Doe');
      expect(cert.clearanceScore).toBe(100);
      expect(cert.status).toBe('CLEARED_FOR_FNF');
    });
  });
});
