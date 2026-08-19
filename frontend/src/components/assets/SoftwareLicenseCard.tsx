// SoftwareLicenseCard — Card for software license tracking with utilization bar
import React from 'react';

interface SoftwareLicenseCardProps {
  softwareName: string; vendor: string; licenseKey: string;
  totalSeats: number; usedSeats: number; expiryDate: string;
  cost: number; autoRenew: boolean; status: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  expiring: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  expired: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const SoftwareLicenseCard: React.FC<SoftwareLicenseCardProps> = ({ softwareName, vendor, licenseKey, totalSeats, usedSeats, expiryDate, cost, autoRenew, status }) => {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.active;
  const utilPct = Math.round((usedSeats / totalSeats) * 100);
  const availableSeats = totalSeats - usedSeats;
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${status === 'expiring' ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '15px', fontWeight: 700 }}>{softwareName}</h3>
          <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{vendor}</p>
        </div>
        <span style={{ background: sc.bg, color: sc.text, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{status}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>USED / TOTAL</p>
          <p style={{ color: '#e2e8f0', margin: '3px 0 0', fontSize: '16px', fontWeight: 700 }}>{usedSeats}<span style={{ color: '#64748b', fontSize: '12px' }}> / {totalSeats}</span></p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>AVAILABLE</p>
          <p style={{ color: availableSeats > 0 ? '#22c55e' : '#ef4444', margin: '3px 0 0', fontSize: '16px', fontWeight: 700 }}>{availableSeats}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>COST/YEAR</p>
          <p style={{ color: '#e2e8f0', margin: '3px 0 0', fontSize: '14px', fontWeight: 700 }}>{fmt(cost)}</p>
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Utilization</span>
          <span style={{ color: utilPct >= 95 ? '#ef4444' : '#e2e8f0', fontSize: '11px', fontWeight: 600 }}>{utilPct}%</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', height: '8px' }}>
          <div style={{
            background: utilPct >= 95 ? 'linear-gradient(90deg, #f97316, #ef4444)' : utilPct >= 80 ? 'linear-gradient(90deg, #eab308, #f97316)' : 'linear-gradient(90deg, #60a5fa, #a78bfa)',
            borderRadius: '6px', height: '100%', width: `${utilPct}%`, transition: 'width 0.8s ease',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
        <div>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>EXPIRES</p>
          <p style={{ color: status === 'expiring' ? '#f97316' : '#e2e8f0', margin: '2px 0 0', fontSize: '12px', fontWeight: 600 }}>{expiryDate}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>AUTO-RENEW</p>
          <p style={{ color: autoRenew ? '#22c55e' : '#94a3b8', margin: '2px 0 0', fontSize: '12px', fontWeight: 600 }}>{autoRenew ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
};

export default SoftwareLicenseCard;
