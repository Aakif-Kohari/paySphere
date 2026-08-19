// EnterpriseTravelDashboardPage — Executive dashboard for travel & expense management intelligence
import React, { useState, useMemo } from 'react';

// ── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_TRAVEL = [
  { id: 'TR-001', employee: 'Sarah Chen', dept: 'Engineering', type: 'conference', purpose: 'AWS re:Invent 2026', dest: 'Las Vegas', country: 'US', depart: '2026-12-01', return: '2026-12-05', cost: { flights: 650, hotel: 1800, ground: 200, meals: 400, total: 3050 }, status: 'approved', priority: 'standard', flags: [], bookingRef: 'AWS-REINVITE-2026-SC' },
  { id: 'TR-002', employee: 'Marcus Weber', dept: 'Product', type: 'client_visit', purpose: 'Meridian Group partnership demo', dest: 'London', country: 'GB', depart: '2026-09-15', return: '2026-09-19', cost: { flights: 2200, hotel: 2400, ground: 350, meals: 500, total: 5450 }, status: 'booked', priority: 'expedited', flags: ['Hotel exceeds per diem by 15%'], bookingRef: 'BA-7891-MW' },
  { id: 'TR-003', employee: 'Priya Patel', dept: 'Finance', type: 'training', purpose: 'CFA Level III bootcamp', dest: 'New York', country: 'US', depart: '2026-10-06', return: '2026-10-17', cost: { flights: 450, hotel: 3200, ground: 150, meals: 800, total: 4600 }, status: 'pending_approval', priority: 'standard', flags: ['Extended stay — 10+ days'], bookingRef: null },
  { id: 'TR-004', employee: 'James Hartley', dept: 'Marketing', type: 'domestic', purpose: 'Q4 Sales Kickoff', dest: 'Chicago', country: 'US', depart: '2026-09-08', return: '2026-09-10', cost: { flights: 380, hotel: 600, ground: 120, meals: 200, total: 1300 }, status: 'completed', priority: 'standard', flags: [], bookingRef: 'AA-3345-JH' },
  { id: 'TR-005', employee: 'Yuki Tanaka', dept: 'Engineering', type: 'international', purpose: 'Tokyo office knowledge transfer', dest: 'Tokyo', country: 'JP', depart: '2026-10-20', return: '2026-10-31', cost: { flights: 1800, hotel: 2800, ground: 400, meals: 700, total: 5700 }, status: 'approved', priority: 'urgent', flags: [], bookingRef: null },
];

const MOCK_EXPENSES = [
  { id: 'ER-001', number: 'EXP-2026-001', employee: 'James Hartley', dept: 'Marketing', title: 'Q4 Sales Kickoff — Chicago', periodStart: '2026-09-08', periodEnd: '2026-09-10', status: 'reimbursed', total: 1155, items: 4, receipts: 4, compliant: 4, complianceScore: 100, paymentMethod: 'corporate_card' },
  { id: 'ER-002', number: 'EXP-2026-002', employee: 'Marcus Weber', dept: 'Product', title: 'Meridian Client Demo — London', periodStart: '2026-09-15', periodEnd: '2026-09-19', status: 'under_review', total: 5580, items: 4, receipts: 4, compliant: 3, complianceScore: 85, paymentMethod: 'personal_card' },
  { id: 'ER-003', number: 'EXP-2026-003', employee: 'Sarah Chen', dept: 'Engineering', title: 'Local Team Offsite — SF', periodStart: '2026-08-15', periodEnd: '2026-08-15', status: 'submitted', total: 350, items: 2, receipts: 2, compliant: 2, complianceScore: 100, paymentMethod: 'corporate_card' },
];

const MOCK_PER_DIEM = [
  { location: 'New York', country: 'US', region: 'NA', lodging: 280, meals: 79, total: 369, highCost: true },
  { location: 'San Francisco', country: 'US', region: 'NA', lodging: 310, meals: 85, total: 407, highCost: true },
  { location: 'Chicago', country: 'US', region: 'NA', lodging: 200, meals: 69, total: 277, highCost: false },
  { location: 'London', country: 'GB', region: 'EMEA', lodging: 220, meals: 65, total: 297, highCost: true },
  { location: 'Tokyo', country: 'JP', region: 'APAC', lodging: 25000, meals: 5500, total: 32000, highCost: true },
  { location: 'Berlin', country: 'DE', region: 'EMEA', lodging: 160, meals: 55, total: 225, highCost: false },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
  pending_approval: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  approved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  booked: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  completed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  submitted: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  under_review: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  reimbursed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

const TRIP_ICONS: Record<string, string> = { domestic: '🏠', international: '🌍', conference: '🎤', client_visit: '🤝', training: '📚' };

const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

type Tab = 'travel' | 'expenses' | 'per_diem' | 'analytics';

const EnterpriseTravelDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('travel');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // ── KPI Stats ─────────────────────────────────────────────────────────────
  const totalTravelSpend = MOCK_TRAVEL.reduce((s, t) => s + t.cost.total, 0);
  const totalExpenseAmount = MOCK_EXPENSES.reduce((s, e) => s + e.total, 0);
  const pendingApprovalCount = MOCK_TRAVEL.filter((t) => t.status === 'pending_approval').length;
  const complianceRate = MOCK_TRAVEL.length > 0 ? Math.round(MOCK_TRAVEL.filter((t) => t.flags.length === 0).length / MOCK_TRAVEL.length * 100) : 0;
  const pendingReimbursement = MOCK_EXPENSES.filter((e) => e.status === 'submitted' || e.status === 'under_review').reduce((s, e) => s + e.total, 0);

  // ── Filtered Data ─────────────────────────────────────────────────────────
  const filteredTravel = useMemo(() => {
    let data = [...MOCK_TRAVEL];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((t) => t.employee.toLowerCase().includes(q) || t.dest.toLowerCase().includes(q) || t.purpose.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((t) => t.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  const filteredExpenses = useMemo(() => {
    let data = [...MOCK_EXPENSES];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((e) => e.employee.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((e) => e.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  const renderKPI = (label: string, value: string, icon: string, color: string) => (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', padding: '18px 20px', flex: 1, minWidth: '170px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <p style={{ color, margin: 0, fontSize: '22px', fontWeight: 700 }}>{value}</p>
    </div>
  );

  const renderBadge = (status: string) => {
    const sc = STATUS_COLORS[status] || STATUS_COLORS.draft;
    return (
      <span style={{ background: sc.bg, color: sc.text, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'travel', label: 'Travel Requests', icon: '✈️' },
    { key: 'expenses', label: 'Expenses', icon: '🧾' },
    { key: 'per_diem', label: 'Per Diem', icon: '💰' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: '#e2e8f0', margin: '0 0 4px', fontSize: '26px', fontWeight: 700 }}>✈️ Enterprise Travel & Expense Management</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Travel requests, expense reports, per diem rates, and policy compliance across all global offices.</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {renderKPI('Travel Spend', formatCurrency(totalTravelSpend), '✈️', '#60a5fa')}
        {renderKPI('Total Expenses', formatCurrency(totalExpenseAmount), '🧾', '#a78bfa')}
        {renderKPI('Pending Approval', pendingApprovalCount.toString(), '⏳', '#eab308')}
        {renderKPI('Compliance Rate', `${complianceRate}%`, '✅', complianceRate >= 80 ? '#22c55e' : '#ef4444')}
        {renderKPI('Pending Reimburse', formatCurrency(pendingReimbursement), '💸', '#fbbf24')}
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
                borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
              }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="🔍 Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: '#e2e8f0', fontSize: '13px', outline: 'none', width: '220px' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 12px', color: '#e2e8f0', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending_approval">Pending</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
        </div>
      </div>

      {/* Travel Requests Tab */}
      {activeTab === 'travel' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
          {filteredTravel.map((t) => (
            <div key={t.id} onClick={() => { setSelectedItem(t); setShowModal(true); }}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '22px' }}>{TRIP_ICONS[t.type] || '✈️'}</span>
                  <div>
                    <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{t.employee}</h3>
                    <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '12px' }}>{t.dept} • {t.dest}, {t.country}</p>
                  </div>
                </div>
                {renderBadge(t.status)}
              </div>
              <p style={{ color: '#94a3b8', margin: '8px 0', fontSize: '12px' }}>{t.purpose}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>📅 {t.depart} → {t.return}</span>
                <span style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 700 }}>{formatCurrency(t.cost.total)}</span>
              </div>
              {t.flags.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '6px 10px', marginTop: '6px' }}>
                  {t.flags.map((f, i) => <p key={i} style={{ color: '#fca5a5', margin: '1px 0', fontSize: '11px' }}>⚠️ {f}</p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {filteredExpenses.map((e) => (
            <div key={e.id} onClick={() => { setSelectedItem(e); setShowModal(true); }}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{e.title}</h3>
                  <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{e.number} • {e.employee}</p>
                </div>
                {renderBadge(e.status)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>📅 {e.periodStart} → {e.periodEnd}</span>
                <span style={{ color: '#a78bfa', fontSize: '16px', fontWeight: 700 }}>{formatCurrency(e.total)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Items</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{e.items}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Receipts</p>
                  <p style={{ color: e.receipts === e.items ? '#22c55e' : '#eab308', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{e.receipts}/{e.items}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Compliance</p>
                  <p style={{ color: e.complianceScore === 100 ? '#22c55e' : '#eab308', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{e.complianceScore}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per Diem Tab */}
      {activeTab === 'per_diem' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Location', 'Country', 'Region', 'Lodging', 'Meals', 'Total/Day', 'High Cost'].map((h) => (
                  <th key={h} style={{ color: '#64748b', padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PER_DIEM.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{p.location}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{p.country}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{p.region}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px' }}>{formatCurrency(p.lodging)}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px' }}>{formatCurrency(p.meals)}</td>
                  <td style={{ color: '#60a5fa', padding: '12px 16px', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(p.total)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '16px' }}>{p.highCost ? '🔴' : '🟢'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Spend by Category */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>📊 Spend by Category</h3>
            {[
              { label: 'Airfare', amount: MOCK_TRAVEL.reduce((s, t) => s + t.cost.flights, 0) },
              { label: 'Hotel', amount: MOCK_TRAVEL.reduce((s, t) => s + t.cost.hotel, 0) },
              { label: 'Ground', amount: MOCK_TRAVEL.reduce((s, t) => s + t.cost.ground, 0) },
              { label: 'Meals', amount: MOCK_TRAVEL.reduce((s, t) => s + t.cost.meals, 0) },
            ].map((c) => (
              <div key={c.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>{c.label}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(c.amount)}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', height: '8px' }}>
                  <div style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', borderRadius: '6px', height: '100%', width: `${(c.amount / totalTravelSpend) * 100}%`, transition: 'width 0.8s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Department Spend */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>🏢 Department Spend</h3>
            {['Engineering', 'Product', 'Finance', 'Marketing'].map((dept) => {
              const deptTrips = MOCK_TRAVEL.filter((t) => t.dept === dept);
              const deptSpend = deptTrips.reduce((s, t) => s + t.cost.total, 0);
              return (
                <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <p style={{ color: '#e2e8f0', margin: 0, fontSize: '13px' }}>{dept}</p>
                    <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '11px' }}>{deptTrips.length} trips</p>
                  </div>
                  <span style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 700 }}>{formatCurrency(deptSpend)}</span>
                </div>
              );
            })}
          </div>

          {/* Top Destinations */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>🌍 Top Destinations</h3>
            {[...MOCK_TRAVEL].sort((a, b) => b.cost.total - a.cost.total).map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ color: '#e2e8f0', margin: 0, fontSize: '13px' }}>{t.dest}, {t.country}</p>
                  <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '11px' }}>{t.purpose}</p>
                </div>
                <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(t.cost.total)}</span>
              </div>
            ))}
          </div>

          {/* Policy Compliance */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>✅ Policy Compliance</h3>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ color: complianceRate >= 80 ? '#22c55e' : '#ef4444', margin: 0, fontSize: '48px', fontWeight: 700 }}>{complianceRate}%</p>
              <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '13px' }}>Overall compliance rate</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', height: '12px', marginBottom: '12px' }}>
              <div style={{
                background: complianceRate >= 80 ? 'linear-gradient(90deg, #22c55e, #34d399)' : 'linear-gradient(90deg, #ef4444, #f97316)',
                borderRadius: '8px', height: '100%', width: `${complianceRate}%`, transition: 'width 0.8s ease',
              }} />
            </div>
            <p style={{ color: '#64748b', margin: 0, fontSize: '12px', textAlign: 'center' }}>
              {MOCK_TRAVEL.filter((t) => t.flags.length > 0).length} trips with policy violations
            </p>
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
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>✕ Close</button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              {Object.entries(selectedItem).filter(([k]) => !['id', 'flags', 'cost'].includes(k)).map(([key, val]) => (
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

export default EnterpriseTravelDashboardPage;
