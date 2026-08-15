'use strict';

const ASTEvaluator = require('../astEvaluator.service');

describe('ASTEvaluator', () => {
  describe('evaluate', () => {
    it('should evaluate Literal nodes', () => {
      expect(ASTEvaluator.evaluate({ type: 'Literal', value: 42 })).toBe(42);
      expect(ASTEvaluator.evaluate({ type: 'Literal', value: 'sales' })).toBe('sales');
    });

    it('should resolve nested path lookup in Identifier nodes', () => {
      const context = {
        payroll: { amount: 15000 },
        employee: { department: 'Engineering' },
      };

      expect(ASTEvaluator.evaluate({ type: 'Identifier', name: 'payroll.amount' }, context)).toBe(15000);
      expect(ASTEvaluator.evaluate({ type: 'Identifier', name: 'employee.department' }, context)).toBe('Engineering');
    });

    it('should evaluate BinaryExpression comparisons', () => {
      const context = { amount: 12000 };

      const nodeGt = {
        type: 'BinaryExpression',
        operator: '>',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 10000 },
      };

      expect(ASTEvaluator.evaluate(nodeGt, context)).toBe(true);

      const nodeLt = {
        type: 'BinaryExpression',
        operator: '<',
        left: { type: 'Identifier', name: 'amount' },
        right: { type: 'Literal', value: 5000 },
      };

      expect(ASTEvaluator.evaluate(nodeLt, context)).toBe(false);
    });

    it('should evaluate LogicalExpression (AND / OR)', () => {
      const context = { amount: 15000, department: 'Sales' };

      const logicalNode = {
        type: 'LogicalExpression',
        operator: '&&',
        left: {
          type: 'BinaryExpression',
          operator: '>=',
          left: { type: 'Identifier', name: 'amount' },
          right: { type: 'Literal', value: 10000 },
        },
        right: {
          type: 'BinaryExpression',
          operator: '==',
          left: { type: 'Identifier', name: 'department' },
          right: { type: 'Literal', value: 'Sales' },
        },
      };

      expect(ASTEvaluator.evaluate(logicalNode, context)).toBe(true);
    });

    it('should evaluate UnaryExpression (! operator)', () => {
      const node = {
        type: 'UnaryExpression',
        operator: '!',
        argument: { type: 'Literal', value: false },
      };

      expect(ASTEvaluator.evaluate(node, {})).toBe(true);
    });
  });

  describe('evaluateRule helper', () => {
    it('should evaluate rule object format { field, operator, value }', () => {
      const rule = { field: 'amount', operator: '>=', value: 5000 };
      expect(ASTEvaluator.evaluateRule(rule, { amount: 6000 })).toBe(true);
      expect(ASTEvaluator.evaluateRule(rule, { amount: 2000 })).toBe(false);
    });
  });
});
