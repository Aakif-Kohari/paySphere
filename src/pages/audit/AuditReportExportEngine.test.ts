/**
 * Unit Tests for Audit Report Export Engine
 */

import { describe, it, expect } from 'vitest';
import { AuditReportExportEngine } from './AuditReportExportEngine';

describe('AuditReportExportEngine Tests', () => {
  it('should generate SOX XML audit export correctly', () => {
    const res = AuditReportExportEngine.generateSoxExport(100);
    expect(res.exportFormat).toBe('XML_SOX');
    expect(res.exportedRecordCount).toBe(100);
  });
});
