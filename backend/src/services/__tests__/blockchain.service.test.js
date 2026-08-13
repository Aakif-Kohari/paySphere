'use strict';

const BlockchainService = require('../blockchain.service');

describe('BlockchainService', () => {
  const samplePayrolls = [
    { _id: 'p1', employeeId: 'emp1', netSalary: 5000, month: 8, year: 2026 },
    { _id: 'p2', employeeId: 'emp2', netSalary: 6200, month: 8, year: 2026 },
    { _id: 'p3', employeeId: 'emp3', netSalary: 4800, month: 8, year: 2026 },
  ];

  describe('buildMerkleTree', () => {
    it('should build binary Merkle tree and return deterministic root hash', () => {
      const tree1 = BlockchainService.buildMerkleTree(samplePayrolls);
      const tree2 = BlockchainService.buildMerkleTree(samplePayrolls);

      expect(tree1.root).toBeDefined();
      expect(tree1.root.length).toBe(64);
      expect(tree1.root).toBe(tree2.root);
      expect(tree1.leaves.length).toBe(3);
    });

    it('should generate empty root for empty input', () => {
      const tree = BlockchainService.buildMerkleTree([]);
      expect(tree.root).toBeDefined();
      expect(tree.leaves.length).toBe(1);
    });
  });

  describe('getMerkleProof & verifyProof', () => {
    it('should generate valid cryptographic proof for an existing payroll item', () => {
      const proofResult = BlockchainService.getMerkleProof(samplePayrolls, 'p2');
      expect(proofResult.leaf).toBeDefined();
      expect(proofResult.proof.length).toBeGreaterThan(0);
      expect(proofResult.verified).toBe(true);
    });

    it('should fail verification if proof hash is tampered', () => {
      const proofResult = BlockchainService.getMerkleProof(samplePayrolls, 'p2');
      const tamperedProof = [...proofResult.proof];
      tamperedProof[0] = { position: 'left', hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' };

      const isValid = BlockchainService.verifyProof(proofResult.leaf, tamperedProof, proofResult.root);
      expect(isValid).toBe(false);
    });
  });

  describe('anchorToEthereum', () => {
    it('should generate simulated Ethereum transaction anchoring metadata', async () => {
      const { root } = BlockchainService.buildMerkleTree(samplePayrolls);
      const anchor = await BlockchainService.anchorToEthereum(root);

      expect(anchor.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(anchor.status).toBe('CONFIRMED');
      expect(anchor.blockNumber).toBeGreaterThan(0);
    });
  });
});
