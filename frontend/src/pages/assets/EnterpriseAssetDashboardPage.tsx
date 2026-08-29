// EnterpriseAssetDashboardPage — Executive dashboard for asset management & IT inventory
import React, { useState, useMemo } from 'react';
import AssetCard from '../../components/assets/AssetCard';

const MOCK_ASSETS = [
  { id: 'A-001', tag: 'IT-2024-001', name: 'MacBook Pro 16" M3', category: 'laptop', model: 'MacBook Pro M3 Max', serial: 'C02X1234H02D', purchaseDate: '2024-06-15', price: 3499, value: 2799, status: 'active', condition: 'excellent', assignedTo: 'Sarah Chen', dept: 'Engineering', location: 'SF Office', warranty: '2027-06-15' },
  { id: 'A-002', tag: 'IT-2024-002', name: 'Dell UltraSharp 27" 4K', category: 'monitor', model: 'U2723QE', serial: 'DL-88421HKJ', purchaseDate: '2024-06-15', price: 619, value: 464, status: 'active', condition: 'good', assignedTo: 'Sarah Chen', dept: 'Engineering', location: 'SF Office', warranty: '2027-06-15' },
  { id: 'A-003', tag: 'IT-2024-003', name: 'iPhone 15 Pro', category: 'phone', model: 'iPhone 15 Pro 256GB', serial: 'FN2X9876GH3K', purchaseDate: '2024-09-01', price: 1199, value: 959, status: 'active', condition: 'excellent', assignedTo: 'Marcus Weber', dept: 'Product', location: 'SF Office', warranty: '2025-09-01' },
  { id: 'A-004', tag: 'IT-2023-004', name: 'ThinkPad X1 Carbon', category: 'laptop', model: 'X1 Carbon Gen 11', serial: 'PF-3KJ2891', purchaseDate: '2023-03-10', price: 1899, value: 1139, status: 'on_loan', condition: 'good', assignedTo: 'James Hartley', dept: 'Marketing', location: 'NYC Office', warranty: '2026-03-10' },
  { id: 'A-005', tag: 'IT-2025-005', name: 'iPad Pro 12.9"', category: 'tablet', model: 'iPad Pro M2', serial: 'DLX88721QW', purchaseDate: '2025-01-20', price: 1099, value: 934, status: 'available', condition: 'excellent', assignedTo: null, dept: 'IT', location: 'SF Storage', warranty: '2027-01-20' },
  { id: 'A-006', tag: 'SRV-2023-001', name: 'Dell PowerEdge R750', category: 'server', model: 'R750 2U', serial: 'SRV-DL-99281', purchaseDate: '2023-08-01', price: 12500, value: 8750, status: 'active', condition: 'good', assignedTo: null, dept: 'IT', location: 'SF DC-R1', warranty: '2028-08-01' },
];

const MOCK_LICENSES = [
  { name: 'Figma Enterprise', vendor: 'Figma Inc.', total: 50, used: 42, expiry: '2027-01-01', cost: 7200, status: 'active' },
  { name: 'GitHub Enterprise', vendor: 'GitHub Inc.', total: 100, used: 87, expiry: '2027-03-15', cost: 25200, status: 'active' },
  { name: 'Slack Business+', vendor: 'Salesforce', total: 621, used: 598, expiry: '2026-10-01', cost: 18630, status: 'expiring' },
  { name: 'Notion Team', vendor: 'Notion Labs', total: 30, used: 30, expiry: '2026-09-15', cost: 3600, status: 'expiring' },
  { name: 'Zoom Business', vendor: 'Zoom Video', total: 621, used: 489, expiry: '2026-12-31', cost: 24840, status: 'active' },
];

const MOCK_REQUESTS = [
  { id: 'R-001', number: 'REQ-2026-001', employee: "Liam O'Brien", dept: 'Operations', type: 'laptop', justification: 'New hire onboarding', priority: 'high', status: 'approved', requestedAt: '2026-08-10' },
  { id: 'R-002', number: 'REQ-2026-002', employee: 'Yuki Tanaka', dept: 'Engineering', type: 'monitor', justification: 'Dual monitor setup', priority: 'medium', status: 'pending', requestedAt: '2026-08-15' },
  { id: 'R-003', number: 'REQ-2026-003', employee: 'Priya Patel', dept: 'Finance', type: 'laptop', justification: 'Hardware failure', priority: 'urgent', status: 'fulfilled', requestedAt: '2026-08-01' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' }, available: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  on_loan: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' }, in_repair: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  retired: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' }, lost: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  pending: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' }, approved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  fulfilled: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' }, denied: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  expiring: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' }, expired: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

const CAT_ICONS: Record<string, string> = { laptop: '💻', monitor: '🖥️', phone: '📱', tablet: '📟', server: '🖧', peripheral: '🖱️', furniture: '🪑', software_license: '💿' };
const PRIORITY_COLORS: Record<string, string> = { low: '#94a3b8', medium: '#eab308', high: '#f97316', urgent: '#ef4444' };

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

type Tab = 'assets' | 'licenses' | 'requests';

const EnterpriseAssetDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('assets');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const totalValue = MOCK_ASSETS.reduce((s, a) => s + a.value, 0);
  const totalLicenseCost = MOCK_LICENSES.reduce((s, l) => s + l.cost, 0);
  const licenseUtil = Math.round(MOCK_LICENSES.reduce((s, l) => s + (l.used / l.total) * 100, 0) / MOCK_LICENSES.length);
  const pendingReqs = MOCK_REQUESTS.filter((r) => r.status === 'pending').length;
  const availableCount = MOCK_ASSETS.filter((a) => a.status === 'available').length;

  const filteredAssets = useMemo(() => {
    let d = [...MOCK_ASSETS];
    if (search) { const q = search.toLowerCase(); d = d.filter((a) => a.name.toLowerCase().includes(q) || a.serial.toLowerCase().includes(q) || (a.assignedTo || '').toLowerCase().includes(q)); }
    if (statusFilter !== 'all') d = d.filter((a) => a.status === statusFilter);
    return d;
  }, [search, statusFilter]);

  const filteredLicenses = useMemo(() => {
    let d = [...MOCK_LICENSES];
    if (search) { const q = search.toLowerCase(); d = d.filter((l) => l.name.toLowerCase().includes(q) || l.vendor.toLowerCase().includes(q)); }
    return d;
  }, [search]);

  const renderKPI = (label: string, value: string, icon: string, color: string) => (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 18px', flex: 1, minWidth: '160px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <p style={{ color, margin: 0, fontSize: '20px', fontWeight: 700 }}>{value}</p>
    </div>
  );

  const renderBadge = (status: string) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.active;
    return <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#e2e8f0', margin: '0 0 4px', fontSize: '26px', fontWeight: 700 }}>🖥️ Enterprise Asset & IT Inventory</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Hardware assets, software licenses, and procurement requests across all global offices.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {renderKPI('Total Asset Value', fmt(totalValue), '💰', '#e2e8f0')}
        {renderKPI('Total Assets', MOCK_ASSETS.length.toString(), '📦', '#60a5fa')}
        {renderKPI('Available', availableCount.toString(), '✅', '#22c55e')}
        {renderKPI('License Spend', fmt(totalLicenseCost), '💿', '#a78bfa')}
        {renderKPI('License Util', `${licenseUtil}%`, '📊', '#fbbf24')}
        {renderKPI('Pending Requests', pendingReqs.toString(), '📋', '#eab308')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
          {([['assets', '📦 Assets'], ['licenses', '💿 Licenses'], ['requests', '📋 Requests']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setSearch(''); setStatusFilter('all'); }}
              style={{ background: activeTab === key ? 'rgba(96,165,250,0.2)' : 'transparent', color: activeTab === key ? '#60a5fa' : '#64748b', border: activeTab === key ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent', borderRadius: '10px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" placeholder="🔍 Search..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: '#e2e8f0', fontSize: '13px', outline: 'none', width: '220px' }} />
      </div>

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }} data-testid="assets-grid">
          {filteredAssets.map((a) => (
            <div key={a.id} onClick={() => { setSelectedItem(a); setShowModal(true); }}>
              <AssetCard
                name={a.name}
                tagNumber={a.tag}
                category={a.category}
                serialNumber={a.serial}
                currentValue={a.value}
                status={a.status}
                condition={a.condition}
                assignedTo={a.assignedTo}
                department={a.dept}
                location={a.location}
                purchaseDate={a.purchaseDate}
                warrantyExpiry={a.warranty}
              />
            </div>
          ))}
        </div>
      )}

      {/* Licenses Tab */}
      {activeTab === 'licenses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
          {filteredLicenses.map((l, i) => {
            const utilPct = Math.round((l.used / l.total) * 100);
            return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${l.status === 'expiring' ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '14px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{l.name}</h3>
                    <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{l.vendor}</p>
                  </div>
                  {renderBadge(l.status)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Seats: {l.used}/{l.total}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>{utilPct}% utilized</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', height: '8px', marginBottom: '10px' }}>
                  <div style={{ background: utilPct >= 95 ? 'linear-gradient(90deg, #f97316, #ef4444)' : 'linear-gradient(90deg, #60a5fa, #a78bfa)', borderRadius: '6px', height: '100%', width: `${utilPct}%`, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Expires: {l.expiry}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700 }}>{fmt(l.cost)}/yr</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Request #', 'Employee', 'Asset Type', 'Justification', 'Priority', 'Status', 'Date'].map((h) => (
                  <th key={h} style={{ color: '#64748b', padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_REQUESTS.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                  onClick={() => { setSelectedItem(r); setShowModal(true); }}>
                  <td style={{ color: '#60a5fa', padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{r.number}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 16px', fontSize: '13px' }}>{r.employee}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{CAT_ICONS[r.type] || '📦'} {r.type}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{r.justification}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ color: PRIORITY_COLORS[r.priority], fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' }}>{r.priority}</span></td>
                  <td style={{ padding: '12px 16px' }}>{renderBadge(r.status)}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 16px', fontSize: '13px' }}>{r.requestedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '18px', fontWeight: 700 }}>{selectedItem.name || selectedItem.number || 'Details'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>✕ Close</button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              {Object.entries(selectedItem).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>{typeof val === 'number' ? val.toLocaleString() : String(val ?? '-')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseAssetDashboardPage;
