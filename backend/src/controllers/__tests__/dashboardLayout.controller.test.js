'use strict';

const {
  validateWidgetOrder,
  DEFAULT_ROLE_PRESETS,
  MAX_WIDGETS,
} = require('../dashboardLayout.controller');

describe('Dashboard Layout Controller', () => {
  describe('validateWidgetOrder', () => {
    it('should validate valid array of widget IDs', () => {
      const result = validateWidgetOrder(['w1', 'w2', 'w3']);
      expect(result.ok).toBe(true);
      expect(result.order).toEqual(['w1', 'w2', 'w3']);
    });

    it('should reject non-array inputs', () => {
      const result = validateWidgetOrder('not_an_array');
      expect(result.ok).toBe(false);
    });

    it('should reject empty or whitespace widget IDs', () => {
      const result = validateWidgetOrder(['w1', '   ']);
      expect(result.ok).toBe(false);
    });

    it('should reject duplicate widget IDs', () => {
      const result = validateWidgetOrder(['w1', 'w1']);
      expect(result.ok).toBe(false);
    });

    it('should reject layouts exceeding MAX_WIDGETS count', () => {
      const largeList = Array.from({ length: MAX_WIDGETS + 1 }, (_, i) => `widget_${i}`);
      const result = validateWidgetOrder(largeList);
      expect(result.ok).toBe(false);
    });
  });

  describe('DEFAULT_ROLE_PRESETS', () => {
    it('should provide default widget presets for ADMIN, HR, FINANCE, EMPLOYEE roles', () => {
      expect(DEFAULT_ROLE_PRESETS.ADMIN).toBeDefined();
      expect(DEFAULT_ROLE_PRESETS.HR).toBeDefined();
      expect(DEFAULT_ROLE_PRESETS.FINANCE).toBeDefined();
      expect(DEFAULT_ROLE_PRESETS.EMPLOYEE).toBeDefined();
    });
  });
});
