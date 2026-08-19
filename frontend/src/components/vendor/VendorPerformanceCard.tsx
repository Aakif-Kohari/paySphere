// VendorPerformanceCard — Glassmorphism KPI card for vendor spend & risk intelligence
import React, { useState } from 'react';

interface VendorPerformanceCardProps {
  vendorName: string;
  tier: string;
  totalSpend: number;
  riskScore: number;
  avgDeliveryDays: number;
  complianceFlags: string[];
  certifications: string[];
  category: string;
}

const tierColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  platinum: { bg: 'rgba(147, 130, 220, 0.15)', border: 'rgba(147, 130, 220, 0.4)', text: '#c4b5fd', glow: '0 0 20px rgba(147, 130, 220, 0.2)' },
  gold: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', text: '#fde047', glow: '0 0 20px rgba(234, 179, 8, 0.2)' },
  silver: { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', text: '#cbd5e1', glow: '0 0 20px rgba(148, 163, 184, 0.2)' },
  bronze: { bg: 'rgba(180, 83, 9, 0.15)', border: 'rgba(180, 83, 9, 0.4)', text: '#fbbf24', glow: '0 0 20px rgba(180, 83, 9, 0.2)' },
  unclassified: { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.4)', text: '#94a3b8', glow: '0 0 20px rgba(100, 116, 139, 0.2)' },
};

const riskColors: Record<string, { bar: string; label: string }> = {
  low: { bar: '#22c55e', label: 'Low Risk' },
  medium: { bar: '#eab308', label: 'Medium Risk' },
  high: { bar: '#f97316', label: 'High Risk' },
  critical: { bar: '#ef4444', label: 'Critical Risk' },
};

const categoryLabels: Record<string, string> = {
  it_hardware: '🖥️ IT Hardware', software: '💿 Software', professional_services: '💼 Professional Services',
  office_supplies: '📦 Office Supplies', logistics: '🚛 Logistics', facilities: '🏢 Facilities',
  consulting: '📊 Consulting', marketing: '📣 Marketing',
};

function getRiskLevel(score: number): string {
  if (score <= 15) return 'low';
  if (score <= 30) return 'medium';
  if (score <= 60) return 'high';
  return 'critical';
}

const VendorPerformanceCard: React.FC<VendorPerformanceCardProps> = ({
  vendorName, tier, totalSpend, riskScore, avgDeliveryDays, complianceFlags, certifications, category,
}) => {
  const [expanded, setExpanded] = useState(false);
  const tierStyle = tierColors[tier] || tierColors.unclassified;
  const risk = riskColors[getRiskLevel(riskScore)] || riskColors.low;
  const spendFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalSpend);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: tierStyle.bg,
        border: `1px solid ${tierStyle.border}`,
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        boxShadow: tierStyle.glow,
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ color: tierStyle.text, margin: 0, fontSize: '16px', fontWeight: 700 }}>{vendorName}</h3>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '13px' }}>{categoryLabels[category] || category}</p>
        </div>
        <span style={{
          background: tierStyle.bg, border: `1px solid ${tierStyle.border}`,
          borderRadius: '8px', padding: '4px 12px', color: tierStyle.text, fontSize: '12px', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {tier}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '11px', textTransform: 'uppercase' }}>YTD Spend</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>{spendFormatted}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '11px', textTransform: 'uppercase' }}>Risk Score</p>
          <p style={{ color: risk.bar, margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>{riskScore}/100</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '11px', textTransform: 'uppercase' }}>Avg Delivery</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>{avgDeliveryDays}d</p>
        </div>
      </div>

      {/* Risk Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>{risk.label}</span>
          <span style={{ color: risk.bar, fontSize: '11px', fontWeight: 600 }}>{riskScore}%</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', height: '6px' }}>
          <div style={{
            background: risk.bar, borderRadius: '6px', height: '100%',
            width: `${Math.min(riskScore, 100)}%`, transition: 'width 0.8s ease',
          }} />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${tierStyle.border}`, paddingTop: '12px', marginTop: '8px' }}>
          {complianceFlags.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: '#ef4444', margin: '0 0 4px', fontSize: '12px', fontWeight: 600 }}>⚠️ Compliance Flags</p>
              {complianceFlags.map((flag, i) => (
                <p key={i} style={{ color: '#fca5a5', margin: '2px 0', fontSize: '12px', paddingLeft: '12px' }}>• {flag}</p>
              ))}
            </div>
          )}
          {certifications.length > 0 && (
            <div>
              <p style={{ color: '#22c55e', margin: '0 0 4px', fontSize: '12px', fontWeight: 600 }}>✅ Certifications</p>
              {certifications.map((cert, i) => (
                <p key={i} style={{ color: '#86efac', margin: '2px 0', fontSize: '12px', paddingLeft: '12px' }}>• {cert}</p>
              ))}
            </div>
          )}
          {complianceFlags.length === 0 && certifications.length === 0 && (
            <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center' }}>No flags or certifications on record</p>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorPerformanceCard;
