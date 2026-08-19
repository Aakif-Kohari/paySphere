// EnterpriseBenefitsDashboardPage — Executive dashboard for benefits management & compensation intelligence
import React, { useState, useMemo } from 'react';

// ── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_ENROLLMENTS = [
  { id: 'ENR-001', employee: 'Sarah Chen', dept: 'Engineering', plan: 'Pinnacle Health Premium', type: 'health_insurance', tier: 'family', status: 'active', premium: 1350, employerContrib: 1080, employeeContrib: 270, ytdEmployerSpend: 12960, dependents: ['David Chen (spouse)', 'Mia Chen (child)'] },
  { id: 'ENR-002', employee: 'Marcus Weber', dept: 'Product', plan: 'Pinnacle Health Premium', type: 'health_insurance', tier: 'individual', status: 'active', premium: 450, employerContrib: 360, employeeContrib: 90, ytdEmployerSpend: 4320, dependents: [] },
  { id: 'ENR-003', employee: 'Priya Patel', dept: 'Finance', plan: 'SecureLife Term 500K', type: 'life_insurance', tier: 'family', status: 'active', premium: 24, employerContrib: 24, employeeContrib: 0, ytdEmployerSpend: 288, dependents: ['Raj Patel (spouse)'] },
  { id: 'ENR-004', employee: 'James Hartley', dept: 'Marketing', plan: 'SecureFuture 401(k)', type: 'retirement_401k', tier: 'individual', status: 'active', premium: 0, employerContrib: 0, employeeContrib: 0, ytdEmployerSpend: 0, dependents: [] },
  { id: 'ENR-005', employee: 'Yuki Tanaka', dept: 'Engineering', plan: 'Pinnacle Health Premium', type: 'health_insurance', tier: 'couple', status: 'active', premium: 900, employerContrib: 720, employeeContrib: 180, ytdEmployerSpend: 8640, dependents: ['Aiko Tanaka (spouse)'] },
  { id: 'ENR-006', employee: "Liam O'Brien", dept: 'Operations', plan: 'WellnessPlus Program', type: 'wellness', tier: 'individual', status: 'active', premium: 0, employerContrib: 0, employeeContrib: 0, ytdEmployerSpend: 0, dependents: [] },
];

const MOCK_COMP_BANDS = [
  { grade: 'executive', title: 'VP / C-Suite', min: 250000, mid: 350000, max: 500000, p25: 280000, p50: 350000, p75: 420000, bonus: 50, benefits: 45000, equityMin: 100000, equityMax: 300000, equityType: 'RSU', headcount: 8, location: 'San Francisco' },
  { grade: 'director', title: 'Director', min: 180000, mid: 220000, max: 280000, p25: 190000, p50: 220000, p75: 260000, bonus: 35, benefits: 38000, equityMin: 50000, equityMax: 150000, equityType: 'RSU', headcount: 22, location: 'San Francisco' },
  { grade: 'senior_manager', title: 'Senior Manager', min: 145000, mid: 175000, max: 210000, p25: 150000, p50: 175000, p75: 200000, bonus: 25, benefits: 32000, equityMin: 25000, equityMax: 75000, equityType: 'RSU', headcount: 45, location: 'New York' },
  { grade: 'manager', title: 'Manager', min: 120000, mid: 145000, max: 175000, p25: 125000, p50: 145000, p75: 165000, bonus: 20, benefits: 28000, equityMin: 15000, equityMax: 50000, equityType: 'RSU', headcount: 78, location: 'New York' },
  { grade: 'senior_ic', title: 'Senior IC', min: 100000, mid: 130000, max: 160000, p25: 108000, p50: 130000, p75: 152000, bonus: 15, benefits: 25000, equityMin: 10000, equityMax: 35000, equityType: 'RSU', headcount: 156, location: 'Austin' },
  { grade: 'individual', title: 'Individual Contributor', min: 75000, mid: 95000, max: 120000, p25: 80000, p50: 95000, p75: 112000, bonus: 10, benefits: 22000, equityMin: 5000, equityMax: 20000, equityType: 'RSU', headcount: 312, location: 'Austin' },
];

const PLAN_TYPE_LABELS: Record<string, string> = {
  health_insurance: '🏥 Health', dental: '🦷 Dental', vision: '👁️ Vision',
  life_insurance: '🛡️ Life', disability: '♿ Disability', retirement_401k: '💰 401(k)',
  hsa: '🏦 HSA', commuter: '🚌 Commuter', wellness: '🧘 Wellness', tuition_reimbursement: '🎓 Tuition',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  pending: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  terminated: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

type Tab = 'enrollments' | 'compensation' | 'analytics';

const EnterpriseBenefitsDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('enrollments');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // ── KPI Stats ─────────────────────────────────────────────────────────────
  const totalEmployerSpend = MOCK_ENROLLMENTS.reduce((s, e) => s + e.ytdEmployerSpend, 0);
  const activeEnrollments = MOCK_ENROLLMENTS.filter((e) => e.status === 'active').length;
  const totalCompBudget = MOCK_COMP_BANDS.reduce((s, b) => s + b.max * b.headcount, 0);
  const avgComp = Math.round(totalCompBudget / 621);
  const healthPlanCount = MOCK_ENROLLMENTS.filter((e) => e.type === 'health_insurance').length;

  // ── Filtered Data ─────────────────────────────────────────────────────────
  const filteredEnrollments = useMemo(() => {
    let data = [...MOCK_ENROLLMENTS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((e) => e.employee.toLowerCase().includes(q) || e.plan.toLowerCase().includes(q) || e.dept.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((e) => e.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  const filteredBands = useMemo(() => {
    let data = [...MOCK_COMP_BANDS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((b) => b.title.toLowerCase().includes(q) || b.location.toLowerCase().includes(q));
    }
    return data;
  }, [searchQuery]);

  // ── KPI Renderer ──────────────────────────────────────────────────────────
  const renderKPI = (label: string, value: string, icon: string, color: string) => (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', padding: '18px 20px', flex: 1, minWidth: '180px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <p style={{ color, margin: 0, fontSize: '22px', fontWeight: 700 }}>{value}</p>
    </div>
  );

  const renderStatusBadge = (status: string) => {
    const sc = STATUS_COLORS[status] || STATUS_COLORS.active;
    return (
      <span style={{
        background: sc.bg, color: sc.text, padding: '4px 10px',
        borderRadius: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
      }}>
        {status}
      </span>
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'enrollments', label: 'Enrollments', icon: '📋' },
    { key: 'compensation', label: 'Comp Bands', icon: '💰' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: '#e2e8f0', margin: '0 0 4px', fontSize: '26px', fontWeight: 700 }}>
          💰 Enterprise Benefits & Compensation
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          Benefits enrollment, compensation benchmarking, and total rewards intelligence across all global offices.
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {renderKPI('YTD Employer Spend', formatCurrency(totalEmployerSpend), '💵', '#22c55e')}
        {renderKPI('Active Enrollments', `${activeEnrollments}`, '📋', '#60a5fa')}
        {renderKPI('Health Plan Members', `${healthPlanCount}`, '🏥', '#a78bfa')}
        {renderKPI('Total Comp Budget', formatCurrency(totalCompBudget), '💰', '#fbbf24')}
        {renderKPI('Avg Comp / Employee', formatCurrency(avgComp), '👤', '#e2e8f0')}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSearchQuery(''); setStatusFilter('all'); }}
              style={{
                background: activeTab === t.key ? 'rgba(96,165,250,0.2)' : 'transparent',
                color: activeTab === t.key ? '#60a5fa' : '#64748b',
                border: activeTab === t.key ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                borderRadius: '10px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
              }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text" placeholder="🔍 Search employees, plans..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '8px 16px', color: '#e2e8f0', fontSize: '13px', outline: 'none', width: '240px',
            }}
          />
          {activeTab === 'enrollments' && (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', padding: '8px 12px', color: '#e2e8f0', fontSize: '13px', outline: 'none', cursor: 'pointer',
              }}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="terminated">Terminated</option>
            </select>
          )}
        </div>
      </div>

      {/* Enrollments Tab */}
      {activeTab === 'enrollments' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {filteredEnrollments.map((e) => (
            <div key={e.id} onClick={() => { setSelectedItem(e); setShowModal(true); }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 600 }}>{e.employee}</h3>
                  <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{e.dept} • {PLAN_TYPE_LABELS[e.type] || e.type}</p>
                </div>
                {renderStatusBadge(e.status)}
              </div>
              <p style={{ color: '#94a3b8', margin: '0 0 10px', fontSize: '12px' }}>{e.plan} ({e.tier})</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Premium</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(e.premium)}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Employer</p>
                  <p style={{ color: '#22c55e', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(e.employerContrib)}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Employee</p>
                  <p style={{ color: '#60a5fa', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(e.employeeContrib)}</p>
                </div>
              </div>
              {e.dependents.length > 0 && (
                <p style={{ color: '#94a3b8', margin: '10px 0 0', fontSize: '11px' }}>👥 {e.dependents.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Compensation Tab */}
      {activeTab === 'compensation' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {filteredBands.map((b) => {
            const range = b.max - b.min;
            return (
              <div key={b.grade}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '15px', fontWeight: 600 }}>{b.title}</h3>
                    <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{b.location} • {b.headcount} headcount</p>
                  </div>
                  <span style={{
                    background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                  }}>{b.grade.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', height: '10px', marginBottom: '8px', position: 'relative' }}>
                  <div style={{
                    background: 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                    borderRadius: '8px', height: '100%', width: '100%',
                  }} />
                  <div style={{ position: 'absolute', left: '50%', top: '-3px', width: '2px', height: '16px', background: '#fff', borderRadius: '1px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{formatCurrency(b.min)}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 600 }}>Mid: {formatCurrency(b.mid)}</span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>{formatCurrency(b.max)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Bonus</p>
                    <p style={{ color: '#fbbf24', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{b.bonus}%</p>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Benefits</p>
                    <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(b.benefits)}</p>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Equity</p>
                    <p style={{ color: '#a78bfa', margin: '2px 0 0', fontSize: '12px', fontWeight: 700 }}>{b.equityType}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Enrollment by Type */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>📊 Enrollment by Plan Type</h3>
            {Object.entries(PLAN_TYPE_LABELS).map(([type, label]) => {
              const count = MOCK_ENROLLMENTS.filter((e) => e.type === type).length;
              const totalPremium = MOCK_ENROLLMENTS.filter((e) => e.type === type).reduce((s, e) => s + e.premium, 0);
              if (count === 0) return null;
              return (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>{label}</span>
                    <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{count} enrollments • {formatCurrency(totalPremium)}/mo</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', height: '8px' }}>
                    <div style={{
                      background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
                      borderRadius: '6px', height: '100%',
                      width: `${(count / MOCK_ENROLLMENTS.length) * 100}%`, transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Employer Spend Breakdown */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>💵 Employer Spend by Employee</h3>
            {MOCK_ENROLLMENTS.sort((a, b) => b.ytdEmployerSpend - a.ytdEmployerSpend).map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ color: '#e2e8f0', margin: 0, fontSize: '13px' }}>{e.employee}</p>
                  <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '11px' }}>{e.plan}</p>
                </div>
                <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(e.ytdEmployerSpend)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 700 }}>Total YTD Spend</span>
              <span style={{ color: '#22c55e', fontSize: '16px', fontWeight: 700 }}>{formatCurrency(totalEmployerSpend)}</span>
            </div>
          </div>

          {/* Compensation Distribution */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px', gridColumn: '1 / -1' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>🎯 Compensation Band Comparison</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {MOCK_COMP_BANDS.map((b) => (
                <div key={b.grade} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ color: '#e2e8f0', margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>{b.title}</p>
                  <p style={{ color: '#64748b', margin: '0 0 4px', fontSize: '12px' }}>Total Comp Range</p>
                  <p style={{ color: '#fbbf24', margin: 0, fontSize: '16px', fontWeight: 700 }}>{formatCurrency(b.min)} — {formatCurrency(b.max)}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>P50: {formatCurrency(b.p50)}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>HC: {b.headcount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
            padding: '28px', maxWidth: '520px', width: '90%', maxHeight: '80vh', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {selectedItem.employee || selectedItem.title || 'Details'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
                ✕ Close
              </button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              {Object.entries(selectedItem).filter(([k]) => !['dependents', 'id'].includes(k)).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>
                    {typeof val === 'number' ? val.toLocaleString() : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseBenefitsDashboardPage;
