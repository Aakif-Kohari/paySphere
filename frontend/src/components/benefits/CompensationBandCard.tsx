// CompensationBandCard — Visual card for salary band benchmarking and market data
import React, { useState } from 'react';

interface CompensationBandCardProps {
  grade: string;
  title: string;
  minSalary: number;
  midpoint: number;
  maxSalary: number;
  marketP25: number;
  marketP50: number;
  marketP75: number;
  bonusTarget: number;
  benefitsValue: number;
  equityRange: { min: number; max: number; type: string };
  headcount: number;
  location: string;
  lastUpdated: string;
}

const gradeColors: Record<string, { gradient: string; accent: string }> = {
  executive: { gradient: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(147,130,220,0.08))', accent: '#a78bfa' },
  director: { gradient: 'linear-gradient(135deg, rgba(96,165,250,0.15), rgba(59,130,246,0.08))', accent: '#60a5fa' },
  senior_manager: { gradient: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(34,197,94,0.08))', accent: '#34d399' },
  manager: { gradient: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(234,179,8,0.08))', accent: '#fbbf24' },
  senior_individual: { gradient: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(236,72,153,0.08))', accent: '#f472b6' },
  individual: { gradient: 'linear-gradient(135deg, rgba(148,163,184,0.15), rgba(100,116,139,0.08))', accent: '#94a3b8' },
};

const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const CompensationBandCard: React.FC<CompensationBandCardProps> = ({
  grade, title, minSalary, midpoint, maxSalary, marketP25, marketP50, marketP75,
  bonusTarget, benefitsValue, equityRange, headcount, location, lastUpdated,
}) => {
  const [expanded, setExpanded] = useState(false);
  const gc = gradeColors[grade] || gradeColors.individual;
  const range = maxSalary - minSalary;

  const renderBandBar = (value: number, label: string, color: string) => {
    const pct = Math.min(Math.max(((value - minSalary) / range) * 100, 0), 100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: '#64748b', fontSize: '11px', width: '80px', textAlign: 'right' }}>{label}</span>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '8px', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: `${pct}%`, top: '-4px',
            width: '2px', height: '16px', background: color, borderRadius: '1px',
          }} />
        </div>
        <span style={{ color, fontSize: '11px', fontWeight: 600, width: '70px' }}>{formatCurrency(value)}</span>
      </div>
    );
  };

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: gc.gradient,
        border: `1px solid ${gc.accent}33`,
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: `0 0 20px ${gc.accent}11`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <h3 style={{ color: gc.accent, margin: 0, fontSize: '16px', fontWeight: 700 }}>{title}</h3>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '12px' }}>{location} • {headcount} employees</p>
        </div>
        <span style={{
          background: `${gc.accent}22`, border: `1px solid ${gc.accent}44`,
          borderRadius: '8px', padding: '4px 10px', color: gc.accent, fontSize: '11px', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {grade.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Salary Range Visual */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '11px' }}>Salary Range</span>
          <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>{formatCurrency(minSalary)} — {formatCurrency(maxSalary)}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', height: '10px', position: 'relative', overflow: 'visible' }}>
          <div style={{
            background: `linear-gradient(90deg, ${gc.accent}66, ${gc.accent})`,
            borderRadius: '8px', height: '100%', width: '100%',
          }} />
          {/* Midpoint marker */}
          <div style={{
            position: 'absolute', left: '50%', top: '-3px',
            width: '2px', height: '16px', background: '#fff', borderRadius: '1px',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: '#64748b', fontSize: '10px' }}>P25: {formatCurrency(marketP25)}</span>
          <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>P50: {formatCurrency(marketP50)}</span>
          <span style={{ color: '#64748b', fontSize: '10px' }}>P75: {formatCurrency(marketP75)}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Bonus Target</p>
          <p style={{ color: gc.accent, margin: '4px 0 0', fontSize: '16px', fontWeight: 700 }}>{bonusTarget}%</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Benefits Value</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '14px', fontWeight: 700 }}>{formatCurrency(benefitsValue)}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Equity</p>
          <p style={{ color: '#e2e8f0', margin: '4px 0 0', fontSize: '12px', fontWeight: 700 }}>
            {equityRange.type === 'none' ? 'N/A' : `${formatCurrency(equityRange.min)}-${formatCurrency(equityRange.max)}`}
          </p>
        </div>
      </div>

      {/* Expanded: Market Comparison Bars */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 8px', fontSize: '12px', fontWeight: 600 }}>📊 Market Percentile Comparison</p>
          {renderBandBar(minSalary, 'Band Min', '#64748b')}
          {renderBandBar(marketP25, 'Market P25', '#94a3b8')}
          {renderBandBar(midpoint, 'Midpoint', gc.accent)}
          {renderBandBar(marketP50, 'Market P50', '#e2e8f0')}
          {renderBandBar(marketP75, 'Market P75', '#fbbf24')}
          {renderBandBar(maxSalary, 'Band Max', '#ef4444')}
          <p style={{ color: '#64748b', margin: '10px 0 0', fontSize: '10px' }}>Last updated: {lastUpdated}</p>
        </div>
      )}
    </div>
  );
};

export default CompensationBandCard;
