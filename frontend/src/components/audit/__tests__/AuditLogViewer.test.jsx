import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AuditLogViewer from '../AuditLogViewer';

describe('AuditLogViewer Component', () => {
  const sampleLogs = [
    {
      id: 'log-1',
      timestamp: '2026-08-20 14:30:00',
      actorName: 'Alice Johnson',
      actorEmail: 'alice@paysphere.io',
      actorRole: 'Payroll Admin',
      action: 'PAYROLL_FINALIZED',
      resourceType: 'PayrollBatch',
      resourceId: 'batch-9812',
      status: 'SUCCESS',
      ipAddress: '192.168.1.100',
      details: { totalAmountUSD: 245000, employeeCount: 142 },
    },
    {
      id: 'log-2',
      timestamp: '2026-08-20 15:00:00',
      actorName: 'Bob Smith',
      actorEmail: 'bob@paysphere.io',
      actorRole: 'HR Manager',
      action: 'USER_ROLE_CHANGED',
      resourceType: 'UserAccount',
      status: 'WARNING',
    },
  ];

  it('renders audit logs table and headers', () => {
    render(<AuditLogViewer logs={sampleLogs} />);

    expect(screen.getByText('Enterprise Audit Trail & Security Ledger')).toBeDefined();
    expect(screen.getByText('PAYROLL_FINALIZED')).toBeDefined();
    expect(screen.getByText('Alice Johnson')).toBeDefined();
    expect(screen.getByText('USER_ROLE_CHANGED')).toBeDefined();
    expect(screen.getByText('SUCCESS')).toBeDefined();
    expect(screen.getByText('WARNING')).toBeDefined();
  });

  it('filters audit records using search input', () => {
    render(<AuditLogViewer logs={sampleLogs} />);

    const searchInput = screen.getByPlaceholderText('Search action, actor email, or resource...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('PAYROLL_FINALIZED')).toBeDefined();
    expect(screen.queryByText('USER_ROLE_CHANGED')).toBeNull();
  });

  it('opens detail modal when an audit row is clicked', () => {
    render(<AuditLogViewer logs={sampleLogs} />);

    const logRow = screen.getByText('PAYROLL_FINALIZED');
    fireEvent.click(logRow);

    expect(screen.getByText('Audit Record Detail')).toBeDefined();
    expect(screen.getByText('log-1')).toBeDefined();
    expect(screen.getByText('192.168.1.100')).toBeDefined();
  });

  it('calls onExportCSV when export button is clicked', () => {
    const onExport = vi.fn();
    render(<AuditLogViewer logs={sampleLogs} onExportCSV={onExport} />);

    const exportBtn = screen.getByText('Export CSV');
    fireEvent.click(exportBtn);
    expect(onExport).toHaveBeenCalled();
  });
});
