// AssetCard — Glassmorphism card for individual asset display
import React from 'react';

interface AssetCardProps {
  name: string; tagNumber: string; category: string; serialNumber: string;
  currentValue: number; status: string; condition: string;
  assignedTo: string | null; department: string; location: string;
  purchaseDate: string; warrantyExpiry: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  available: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  on_loan: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
  in_repair: { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
  retired: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
};

const CAT_ICONS: Record<string, string> = { laptop: '💻', monitor: '🖥️', phone: '📱', tablet: '📟', server: '🖧', peripheral: '🖱️', furniture: '🪑', software_license: '💿' };
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const AssetCard: React.FC<AssetCardProps> = ({ name, tagNumber, category, serialNumber, currentValue, status, condition, assignedTo, department, location, purchaseDate, warrantyExpiry }) => {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.active;
  return (
    <div data-testid="asset-card" style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '16px', padding: '20px', cursor: 'pointer', boxShadow: '0 0 20px rgba(96,165,250,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '28px' }}>{CAT_ICONS[category] || '📦'}</span>
          <div>
            <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '15px', fontWeight: 700 }}>{name}</h3>
            <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{tagNumber} • {serialNumber}</p>
          </div>
        </div>
        <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>VALUE</p>
          <p style={{ color: '#e2e8f0', margin: '3px 0 0', fontSize: '14px', fontWeight: 700 }}>{fmt(currentValue)}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>CONDITION</p>
          <p style={{ color: condition === 'excellent' ? '#22c55e' : condition === 'good' ? '#60a5fa' : '#eab308', margin: '3px 0 0', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>{condition}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>ASSIGNEE</p>
          <p style={{ color: assignedTo ? '#22c55e' : '#94a3b8', margin: '3px 0 0', fontSize: '12px', fontWeight: 600 }}>{assignedTo || 'None'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${sc.border}`, paddingTop: '10px' }}>
        <div>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>PURCHASED</p>
          <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '12px' }}>{purchaseDate}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>WARRANTY</p>
          <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '12px' }}>{warrantyExpiry}</p>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
