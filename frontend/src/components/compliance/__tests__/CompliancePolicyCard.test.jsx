import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CompliancePolicyCard from '../CompliancePolicyCard';

describe('CompliancePolicyCard Component', () => {
  const samplePolicy = {
    id: 'pol-1',
    policyName: 'POSH Anti-Harassment Standard Policy',
    category: 'STATUTORY',
    jurisdiction: 'India (Central)',
    status: 'ACTIVE',
    version: '2.1',
    effectiveDate: '2026-01-01',
    lastReviewedAt: '2026-08-01',
    mandatoryAcknowledgment: true,
    acknowledgedCount: 95,
    totalEligibleEmployees: 100,
    description: 'Mandatory annual anti-harassment policy and ICC constitution guidelines.',
  };

  it('renders policy details correctly', () => {
    render(<CompliancePolicyCard policy={samplePolicy} />);

    expect(screen.getByText('POSH Anti-Harassment Standard Policy')).toBeDefined();
    expect(screen.getByText('India (Central)')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText('v2.1')).toBeDefined();
    expect(screen.getByText('95%')).toBeDefined();
  });

  it('triggers onAcknowledge when sign policy button is clicked', () => {
    const onAcknowledge = vi.fn();
    render(<CompliancePolicyCard policy={samplePolicy} onAcknowledge={onAcknowledge} />);

    const signButton = screen.getByText('Sign Policy');
    fireEvent.click(signButton);
    expect(onAcknowledge).toHaveBeenCalledWith(samplePolicy);
  });

  it('triggers onView when inspect button is clicked', () => {
    const onView = vi.fn();
    render(<CompliancePolicyCard policy={samplePolicy} onView={onView} />);

    const inspectButton = screen.getByText('Inspect');
    fireEvent.click(inspectButton);
    expect(onView).toHaveBeenCalledWith(samplePolicy);
  });
});
