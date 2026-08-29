/**
 * Unit Tests for State Admin Fee Extensions
 */

import { describe, it, expect } from 'vitest';
import { GarnishmentStateAdminExtensions } from './GarnishmentStateAdminExtensions';

describe('GarnishmentStateAdminExtensions Tests', () => {
  it('should return correct state administrative fee', () => {
    expect(GarnishmentStateAdminExtensions.calculateStateAdminFee('CA')).toBe(1.50);
    expect(GarnishmentStateAdminExtensions.calculateStateAdminFee('FL')).toBe(5.00);
  });
});
