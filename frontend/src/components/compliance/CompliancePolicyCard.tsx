// CompliancePolicyCard — Glassmorphism card for compliance policy display
import React from 'react';

interface CompliancePolicyCardProps {
  name: string; category: string; owner: string; status: string;
  lastReviewed: string; nextReview: string; risk: string; regions: string[]; reqCount: number;
}

const SEV_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const CAT_ICONS: Record<string, string> = { data_privacy: '🔒', financial: '💰', security: '🛡️', labor: '👥', environmental: '🌿', internal_policy: '📜' };

const CompliancePolicyCard: React.FC<CompliancePolicyCardProps> = ({ name, category, owner, status, lastReviewed, nextReview, risk, regions, reqCount }) => {
  const riskColor = SEV_COLORS[risk] || '#94a3b8';
  return (
    <div style={{ background: `${riskColor}11`, border: `1px solid ${riskColor}33`, borderRadius: '16px', padding: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '24px' }}>{CAT_ICONS[category] || '📜'}</span>
          <div>
            <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{name}</h3>
            <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>Owner: {owner}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ color: riskColor, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', background: `${riskColor}22`, padding: '3px 8px', borderRadius: '6px' }}>{risk}</span>
          <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '10px' }}>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '9px' }}>REQUIREMENTS</p>
          <p style={{ color: '#a78bfa', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{reqCount}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '9px' }}>REGIONS</p>
          <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '12px', fontWeight: 600 }}>{regions.join(', ')}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '9px' }}>NEXT REVIEW</p>
          <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '12px' }}>{nextReview}</p>
        </div>
      </div>
    </div>
  );
};

// Category display labels for policy type rendering
export const CATEGORY_LABELS: Record<string, string> = {
  data_privacy: 'Data Privacy', financial: 'Financial', security: 'Security',
  labor: 'Labor & Employment', environmental: 'Environmental', industry: 'Industry', internal_policy: 'Internal Policy',
};

export default CompliancePolicyCard;
