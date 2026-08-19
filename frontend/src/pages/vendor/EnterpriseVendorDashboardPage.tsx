// EnterpriseVendorDashboardPage — Executive dashboard for vendor management & procurement intelligence
import React, { useState, useMemo } from 'react';

// ── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_VENDORS = [
  { id: 'VEN-001', name: 'TechNova Solutions', tier: 'platinum', category: 'IT Hardware', totalSpend: 2450000, riskScore: 12, avgDeliveryDays: 5, complianceFlags: [], certifications: ['ISO 27001', 'SOC 2 Type II'], status: 'active' },
  { id: 'VEN-002', name: 'CloudPeak Systems', tier: 'gold', category: 'Software', totalSpend: 890000, riskScore: 18, avgDeliveryDays: 2, complianceFlags: ['GDPR review pending'], certifications: ['ISO 27001'], status: 'active' },
  { id: 'VEN-003', name: 'Meridian Consulting', tier: 'silver', category: 'Consulting', totalSpend: 670000, riskScore: 25, avgDeliveryDays: 14, complianceFlags: [], certifications: ['ISO 9001'], status: 'active' },
  { id: 'VEN-004', name: 'Sakura IT Services', tier: 'bronze', category: 'IT Hardware', totalSpend: 340000, riskScore: 42, avgDeliveryDays: 8, complianceFlags: ['Security questionnaire outstanding'], certifications: [], status: 'under_review' },
  { id: 'VEN-005', name: 'Apex Facility Services', tier: 'gold', category: 'Facilities', totalSpend: 520000, riskScore: 15, avgDeliveryDays: 3, complianceFlags: [], certifications: ['ISO 14001'], status: 'active' },
  { id: 'VEN-006', name: 'Nordic Logistics AB', tier: 'platinum', category: 'Logistics', totalSpend: 1870000, riskScore: 10, avgDeliveryDays: 2, complianceFlags: [], certifications: ['ISO 9001', 'AEO Certified'], status: 'active' },
];

const MOCK_POS = [
  { id: 'PO-1001', number: 'PO-2026-1001', vendor: 'TechNova Solutions', status: 'approved', total: 92595.50, currency: 'USD', requestedBy: 'David Kim', expectedDelivery: '2026-08-15', itemCount: 2 },
  { id: 'PO-1002', number: 'PO-2026-1002', vendor: 'CloudPeak Systems', status: 'sent', total: 142800, currency: 'EUR', requestedBy: 'Anna Petrova', expectedDelivery: '2026-08-30', itemCount: 1 },
  { id: 'PO-1003', number: 'PO-2026-1003', vendor: 'Apex Facility Services', status: 'received', total: 33550, currency: 'AUD', requestedBy: 'Facilities Team', expectedDelivery: '2026-07-25', itemCount: 2 },
  { id: 'PO-1004', number: 'PO-2026-1004', vendor: 'Nordic Logistics AB', status: 'pending_approval', total: 29100, currency: 'SEK', requestedBy: 'Supply Chain Team', expectedDelivery: '2026-09-05', itemCount: 2 },
];

const MOCK_INVOICES = [
  { id: 'INV-5001', number: 'TN-INV-2026-0891', vendor: 'TechNova Solutions', status: 'paid', total: 92595.50, currency: 'USD', dueDate: '2026-08-30', threeWayMatch: true },
  { id: 'INV-5002', number: 'CP-INV-2026-0234', vendor: 'CloudPeak Systems', status: 'received', total: 142800, currency: 'EUR', dueDate: '2026-09-15', threeWayMatch: false },
  { id: 'INV-5003', number: 'AF-INV-2026-0445', vendor: 'Apex Facility Services', status: 'discrepancy', total: 33550, currency: 'AUD', dueDate: '2026-08-25', threeWayMatch: false },
  { id: 'INV-5004', number: 'NL-INV-2026-1190', vendor: 'Nordic Logistics AB', status: 'overdue', total: 29100, currency: 'SEK', dueDate: '2026-08-01', threeWayMatch: false },
];

const MOCK_CONTRACTS = [
  { id: 'CTR-2001', number: 'MSA-TN-2023', vendor: 'TechNova Solutions', title: 'Master Services Agreement — Hardware Supply', status: 'active', value: 5000000, currency: 'USD', endDate: '2027-12-31', riskRating: 'low' },
  { id: 'CTR-2002', number: 'SaaS-CP-2024', vendor: 'CloudPeak Systems', title: 'SaaS Platform License Agreement', status: 'expiring_30d', value: 840000, currency: 'EUR', endDate: '2026-08-31', riskRating: 'high' },
  { id: 'CTR-2003', number: 'LOG-NL-2022', vendor: 'Nordic Logistics AB', title: 'Global Logistics & Freight Partnership', status: 'active', value: 3200000, currency: 'SEK', endDate: '2026-03-31', riskRating: 'low' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  active: '#22c55e', inactive: '#64748b', pending: '#eab308', under_review: '#f97316', blacklisted: '#ef4444',
  draft: '#64748b', pending_approval: '#eab308', approved: '#22c55e', sent: '#60a5fa', received: '#a78bfa', closed: '#22c55e', cancelled: '#ef4444',
  matched: '#22c55e', discrepancy: '#f97316', paid: '#22c55e', overdue: '#ef4444',
  expiring_30d: '#ef4444', expiring_90d: '#f97316', expired: '#64748b', renewal_pending: '#eab308',
};

const formatCurrency = (n: number, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

type Tab = 'vendors' | 'purchase_orders' | 'invoices' | 'contracts';

const EnterpriseVendorDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('vendors');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // ── KPI Stats ─────────────────────────────────────────────────────────────
  const totalSpend = MOCK_VENDORS.reduce((s, v) => s + v.totalSpend, 0);
  const activeVendors = MOCK_VENDORS.filter((v) => v.status === 'active').length;
  const overdueAmount = MOCK_INVOICES.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const openPOCount = MOCK_POS.filter((p) => ['pending_approval', 'approved', 'sent'].includes(p.status)).length;
  const expiringContracts = MOCK_CONTRACTS.filter((c) => c.status.includes('expiring')).length;

  // ── Filtered Data ─────────────────────────────────────────────────────────
  const filteredVendors = useMemo(() => {
    let data = [...MOCK_VENDORS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((v) => v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((v) => v.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  const filteredPOs = useMemo(() => {
    let data = [...MOCK_POS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((p) => p.number.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((p) => p.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  const filteredInvoices = useMemo(() => {
    let data = [...MOCK_INVOICES];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((i) => i.number.toLowerCase().includes(q) || i.vendor.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((i) => i.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  const filteredContracts = useMemo(() => {
    let data = [...MOCK_CONTRACTS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((c) => c.number.toLowerCase().includes(q) || c.vendor.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') data = data.filter((c) => c.status === statusFilter);
    return data;
  }, [searchQuery, statusFilter]);

  // ── Render Helpers ────────────────────────────────────────────────────────
  const renderKPI = (label: string, value: string | number, icon: string, color: string) => (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', padding: '20px', flex: 1, minWidth: '200px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <p style={{ color, margin: 0, fontSize: '24px', fontWeight: 700 }}>{value}</p>
    </div>
  );

  const renderStatusBadge = (status: string) => (
    <span style={{
      background: `${statusColors[status] || '#64748b'}22`, color: statusColors[status] || '#64748b',
      padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'vendors', label: 'Vendors', icon: '🏢' },
    { key: 'purchase_orders', label: 'Purchase Orders', icon: '📋' },
    { key: 'invoices', label: 'Invoices', icon: '🧾' },
    { key: 'contracts', label: 'Contracts', icon: '📄' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: '#e2e8f0', margin: '0 0 4px', fontSize: '26px', fontWeight: 700 }}>
          🏢 Enterprise Vendor Management & Procurement
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
          Vendor lifecycle, purchase orders, invoice processing, and contract intelligence across all global operations.
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {renderKPI('Total Vendor Spend', formatCurrency(totalSpend), '💰', '#e2e8f0')}
        {renderKPI('Active Vendors', `${activeVendors}/${MOCK_VENDORS.length}`, '🏢', '#22c55e')}
        {renderKPI('Open POs', openPOCount.toString(), '📋', '#60a5fa')}
        {renderKPI('Overdue Invoices', formatCurrency(overdueAmount), '🚨', '#ef4444')}
        {renderKPI('Expiring Contracts', expiringContracts.toString(), '⏰', '#f97316')}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setStatusFilter('all'); setSearchQuery(''); }}
              style={{
                background: activeTab === t.key ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
                color: activeTab === t.key ? '#60a5fa' : '#64748b',
                border: activeTab === t.key ? '1px solid rgba(96, 165, 250, 0.3)' : '1px solid transparent',
                borderRadius: '10px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
              }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="🔍 Search vendors, POs, invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '8px 16px', color: '#e2e8f0', fontSize: '13px', outline: 'none', width: '260px',
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '8px 12px', color: '#e2e8f0', fontSize: '13px', outline: 'none', cursor: 'pointer',
            }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="overdue">Overdue</option>
            <option value="discrepancy">Discrepancy</option>
            <option value="under_review">Under Review</option>
            <option value="expiring_30d">Expiring 30d</option>
          </select>
        </div>
      </div>

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {filteredVendors.map((v) => (
            <div key={v.id} onClick={() => { setSelectedItem(v); setShowModal(true); }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '15px', fontWeight: 600 }}>{v.name}</h3>
                  <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '12px' }}>{v.category}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {renderStatusBadge(v.status)}
                  <span style={{
                    background: `${v.tier === 'platinum' ? '#a78bfa' : v.tier === 'gold' ? '#fbbf24' : v.tier === 'silver' ? '#94a3b8' : '#b45309'}22`,
                    color: v.tier === 'platinum' ? '#a78bfa' : v.tier === 'gold' ? '#fbbf24' : v.tier === 'silver' ? '#94a3b8' : '#b45309',
                    padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                  }}>{v.tier}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Spend YTD</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{formatCurrency(v.totalSpend)}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Risk</p>
                  <p style={{ color: v.riskScore <= 15 ? '#22c55e' : v.riskScore <= 30 ? '#eab308' : '#ef4444', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{v.riskScore}/100</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Delivery</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{v.avgDeliveryDays}d</p>
                </div>
              </div>
              {v.complianceFlags.length > 0 && (
                <div style={{ marginTop: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '8px 12px' }}>
                  {v.complianceFlags.map((f, i) => <p key={i} style={{ color: '#fca5a5', margin: '2px 0', fontSize: '11px' }}>⚠️ {f}</p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === 'purchase_orders' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['PO Number', 'Vendor', 'Items', 'Total', 'Status', 'Requested By', 'Expected Delivery'].map((h) => (
                  <th key={h} style={{ color: '#64748b', padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                  onClick={() => { setSelectedItem(p); setShowModal(true); }}>
                  <td style={{ color: '#60a5fa', padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{p.number}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px' }}>{p.vendor}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{p.itemCount} items</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(p.total, p.currency)}</td>
                  <td style={{ padding: '12px 16px' }}>{renderStatusBadge(p.status)}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{p.requestedBy}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{p.expectedDelivery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Invoice #', 'Vendor', 'Amount', 'Due Date', 'Status', '3-Way Match'].map((h) => (
                  <th key={h} style={{ color: '#64748b', padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                  onClick={() => { setSelectedItem(inv); setShowModal(true); }}>
                  <td style={{ color: '#f472b6', padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{inv.number}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px' }}>{inv.vendor}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(inv.total, inv.currency)}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{inv.dueDate}</td>
                  <td style={{ padding: '12px 16px' }}>{renderStatusBadge(inv.status)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '16px' }}>{inv.threeWayMatch ? '✅' : '❌'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {filteredContracts.map((c) => (
            <div key={c.id} onClick={() => { setSelectedItem(c); setShowModal(true); }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.status.includes('expiring') ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 600 }}>{c.title}</h3>
                  <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '12px' }}>{c.number} • {c.vendor}</p>
                </div>
                {renderStatusBadge(c.status)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Contract Value</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '16px', fontWeight: 700 }}>{formatCurrency(c.value, c.currency)}</p>
                </div>
                <div>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Expires</p>
                  <p style={{ color: c.status.includes('expiring') ? '#f97316' : '#e2e8f0', margin: '2px 0 0', fontSize: '14px', fontWeight: 600 }}>{c.endDate}</p>
                </div>
                <div>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px', textTransform: 'uppercase' }}>Risk</p>
                  <p style={{ color: c.riskRating === 'high' ? '#f97316' : '#22c55e', margin: '2px 0 0', fontSize: '14px', fontWeight: 600 }}>{c.riskRating}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
            padding: '28px', maxWidth: '560px', width: '90%', maxHeight: '80vh', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {selectedItem.name || selectedItem.number || selectedItem.title || 'Details'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
                ✕ Close
              </button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              {Object.entries(selectedItem).filter(([k]) => !['id', 'complianceFlags', 'certifications'].includes(k)).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
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

export default EnterpriseVendorDashboardPage;
