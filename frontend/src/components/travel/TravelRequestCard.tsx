// TravelRequestCard — Glassmorphism card for travel request display with cost breakdown
import React, { useState } from 'react';

interface TravelRequestCardProps {
  employeeName: string;
  department: string;
  purpose: string;
  destination: string;
  country: string;
  tripType: string;
  departureDate: string;
  returnDate: string;
  estimatedCost: { flights: number; hotel: number; ground: number; meals: number; total: number };
  status: string;
  priority: string;
  complianceFlags: string[];
  bookingRef: string | null;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  pending_approval: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
  approved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  booked: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  in_progress: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
  completed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  denied: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

const tripTypeIcons: Record<string, string> = {
  domestic: '🏠', international: '🌍', conference: '🎤', client_visit: '🤝', training: '📚', relocation: '📦',
};

const priorityColors: Record<string, { bg: string; text: string }> = {
  standard: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
  expedited: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  urgent: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const TravelRequestCard: React.FC<TravelRequestCardProps> = ({
  employeeName, department, purpose, destination, country, tripType, departureDate, returnDate,
  estimatedCost, status, priority, complianceFlags, bookingRef,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sc = statusColors[status] || statusColors.draft;
  const pc = priorityColors[priority] || priorityColors.standard;
  const icon = tripTypeIcons[tripType] || '✈️';

  const days = Math.max(1, Math.round((new Date(returnDate).getTime() - new Date(departureDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${sc.border}`,
        borderRadius: '16px',
        padding: '18px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{icon}</span>
          <div>
            <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{employeeName}</h3>
            <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '12px' }}>{department} • {destination}, {country}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ background: pc.bg, color: pc.text, padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
            {priority}
          </span>
          <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Purpose & Dates */}
      <p style={{ color: '#94a3b8', margin: '0 0 10px', fontSize: '12px', lineHeight: '1.4' }}>{purpose}</p>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        <span style={{ color: '#64748b', fontSize: '12px' }}>📅 {departureDate} → {returnDate}</span>
        <span style={{ color: '#64748b', fontSize: '12px' }}>🕐 {days} days</span>
      </div>

      {/* Cost Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {[
          { label: 'Flights', value: estimatedCost.flights },
          { label: 'Hotel', value: estimatedCost.hotel },
          { label: 'Ground', value: estimatedCost.ground },
          { label: 'Meals', value: estimatedCost.meals },
          { label: 'Total', value: estimatedCost.total },
        ].map((item) => (
          <div key={item.label} style={{
            textAlign: 'center', background: item.label === 'Total' ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.03)',
            borderRadius: '8px', padding: '8px 4px',
          }}>
            <p style={{ color: '#64748b', margin: 0, fontSize: '9px', textTransform: 'uppercase' }}>{item.label}</p>
            <p style={{ color: item.label === 'Total' ? '#60a5fa' : '#e2e8f0', margin: '3px 0 0', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
          {bookingRef && (
            <p style={{ color: '#60a5fa', margin: '0 0 6px', fontSize: '12px' }}>🔖 Booking Ref: {bookingRef}</p>
          )}
          {complianceFlags.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '8px 12px', marginBottom: '8px' }}>
              {complianceFlags.map((f, i) => <p key={i} style={{ color: '#fca5a5', margin: '2px 0', fontSize: '11px' }}>⚠️ {f}</p>)}
            </div>
          )}
          {complianceFlags.length === 0 && (
            <p style={{ color: '#22c55e', margin: 0, fontSize: '12px' }}>✅ No compliance flags</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TravelRequestCard;
