// EnterpriseComplianceDashboardPage — Executive dashboard for compliance & audit trail intelligence
import React, { useState, useMemo } from 'react';

const MOCK_POLICIES = [
  { id: 'CP-001', name: 'GDPR Data Processing Policy', category: 'data_privacy', owner: 'DPO Office', status: 'active', lastReviewed: '2026-03-15', nextReview: '2027-03-15', risk: 'critical', regions: ['EU', 'UK'], reqCount: 4 },
  { id: 'CP-002', name: 'SOX Financial Controls', category: 'financial', owner: 'CFO Office', status: 'active', lastReviewed: '2026-06-01', nextReview: '2027-01-01', risk: 'critical', regions: ['US'], reqCount: 4 },
  { id: 'CP-003', name: 'ISO 27001 Information Security', category: 'security', owner: 'CISO', status: 'active', lastReviewed: '2026-01-10', nextReview: '2026-12-01', risk: 'high', regions: ['Global'], reqCount: 4 },
  { id: 'CP-004', name: 'FLSA Labor Compliance', category: 'labor', owner: 'HR Legal', status: 'active', lastReviewed: '2026-02-20', nextReview: '2027-02-20', risk: 'high', regions: ['US'], reqCount: 4 },
  { id: 'CP-005', name: 'Environmental Sustainability', category: 'environmental', owner: 'ESG Committee', status: 'active', lastReviewed: '2026-07-01', nextReview: '2027-07-01', risk: 'medium', regions: ['Global'], reqCount: 4 },
  { id: 'CP-006', name: 'Code of Business Conduct', category: 'internal_policy', owner: 'Legal', status: 'active', lastReviewed: '2026-06-01', nextReview: '2027-06-01', risk: 'high', regions: ['Global'], reqCount: 4 },
];

const MOCK_AUDITS = [
  { id: 'AU-001', number: 'AUD-2026-001', title: 'Q2 Financial Controls Audit', category: 'financial', auditor: 'Deloitte LLP', date: '2026-06-15', status: 'completed', score: 85, findings: 2, openFindings: 1, nextAudit: '2026-12-15', region: 'US' },
  { id: 'AU-002', number: 'AUD-2026-002', title: 'GDPR Annual Compliance', category: 'data_privacy', auditor: 'Internal Audit', date: '2026-03-10', status: 'completed', score: 92, findings: 1, openFindings: 0, nextAudit: '2027-03-10', region: 'EU' },
  { id: 'AU-003', number: 'AUD-2026-003', title: 'ISO 27001 Surveillance Audit', category: 'security', auditor: 'BSI Group', date: '2026-09-01', status: 'in_progress', score: null, findings: 0, openFindings: 0, nextAudit: '2027-09-01', region: 'Global' },
  { id: 'AU-004', number: 'AUD-2026-004', title: 'Q3 Payroll Compliance', category: 'labor', auditor: 'Internal Audit', date: '2026-10-15', status: 'scheduled', score: null, findings: 0, openFindings: 0, nextAudit: '2027-01-15', region: 'US' },
];

const MOCK_INCIDENTS = [
  { id: 'CI-001', number: 'INC-2026-001', title: 'Unauthorized data export', category: 'data_privacy', severity: 'critical', reportedBy: 'DPO Office', date: '2026-07-20', status: 'investigating', affectedRecords: 621, region: 'Global' },
  { id: 'CI-002', number: 'INC-2026-002', title: 'Suspicious login attempts', category: 'security', severity: 'high', reportedBy: 'SOC Team', date: '2026-08-05', status: 'contained', affectedRecords: 0, region: 'US' },
  { id: 'CI-003', number: 'INC-2026-003', title: 'Missing SOX audit trail', category: 'financial', severity: 'medium', reportedBy: 'Internal Audit', date: '2026-06-20', status: 'resolved', affectedRecords: 12, region: 'US' },
];

const MOCK_FINDINGS = [
  { id: 'F-001', audit: 'AUD-2026-001', description: 'Segregation of duties gap in AP process', severity: 'high', remediation: 'in_progress', assignedTo: 'Finance Ops', dueDate: '2026-09-30' },
  { id: 'F-002', audit: 'AUD-2026-001', description: 'Manual journal entries missing management approval', severity: 'medium', remediation: 'open', assignedTo: 'IT Finance Systems', dueDate: '2026-10-31' },
  { id: 'F-003', audit: 'AUD-2026-002', description: 'Cookie consent not blocking tracking before consent', severity: 'high', remediation: 'resolved', assignedTo: 'Web Team', dueDate: '2026-05-01' },
];

const SEV_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' }, completed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  in_progress: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' }, scheduled: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
  overdue: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' }, investigating: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  contained: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' }, resolved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  open: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' }, remediation: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
};
const CAT_ICONS: Record<string, string> = { data_privacy: '🔒', financial: '💰', security: '🛡️', labor: '👥', environmental: '🌿', industry: '🏭', internal_policy: '📜' };
const REM_COLORS: Record<string, string> = { open: '#ef4444', in_progress: '#eab308', resolved: '#22c55e', verified: '#60a5fa' };

type Tab = 'policies' | 'audits' | 'incidents' | 'findings';

const EnterpriseComplianceDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('policies');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const totalFindings = MOCK_AUDITS.reduce((s, a) => s + a.findings, 0);
  const openFindings = MOCK_FINDINGS.filter((f) => f.remediation === 'open' || f.remediation === 'in_progress').length;
  const avgScore = MOCK_AUDITS.filter((a) => a.score !== null).reduce((s, a, _, arr) => s + (a.score || 0) / arr.length, 0);
  const openIncidents = MOCK_INCIDENTS.filter((i) => i.status !== 'resolved' && i.status !== 'closed').length;

  const filteredPolicies = useMemo(() => {
    let d = [...MOCK_POLICIES];
    if (search) { const q = search.toLowerCase(); d = d.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)); }
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
        <h1 style={{ color: '#e2e8f0', margin: '0 0 4px', fontSize: '26px', fontWeight: 700 }}>🛡️ Enterprise Compliance & Audit Trail</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Policy management, audit tracking, incident response, and compliance intelligence.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {renderKPI('Active Policies', MOCK_POLICIES.filter((p) => p.status === 'active').length.toString(), '📜', '#22c55e')}
        {renderKPI('Avg Audit Score', `${Math.round(avgScore)}%`, '📊', '#60a5fa')}
        {renderKPI('Open Findings', openFindings.toString(), '🔍', '#f97316')}
        {renderKPI('Open Incidents', openIncidents.toString(), '🚨', '#ef4444')}
        {renderKPI('Total Findings', totalFindings.toString(), '📋', '#a78bfa')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
          {([['policies', '📜 Policies'], ['audits', '🔍 Audits'], ['incidents', '🚨 Incidents'], ['findings', '📋 Findings']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setSearch(''); }}
              style={{ background: activeTab === key ? 'rgba(96,165,250,0.2)' : 'transparent', color: activeTab === key ? '#60a5fa' : '#64748b', border: activeTab === key ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" placeholder="🔍 Search..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 16px', color: '#e2e8f0', fontSize: '13px', outline: 'none', width: '220px' }} />
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
          {filteredPolicies.map((p) => (
            <div key={p.id} onClick={() => { setSelectedItem(p); setShowModal(true); }}
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${SEV_COLORS[p.risk]}33`, borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '22px' }}>{CAT_ICONS[p.category] || '📜'}</span>
                  <div>
                    <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{p.name}</h3>
                    <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '11px' }}>Owner: {p.owner}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: SEV_COLORS[p.risk], fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', background: `${SEV_COLORS[p.risk]}22`, padding: '3px 8px', borderRadius: '6px' }}>{p.risk}</span>
                  {renderBadge(p.status)}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                <div>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>REVIEWED</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '12px' }}>{p.lastReviewed}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>REQUIREMENTS</p>
                  <p style={{ color: '#a78bfa', margin: '2px 0 0', fontSize: '12px', fontWeight: 600 }}>{p.reqCount}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>NEXT REVIEW</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '12px' }}>{p.nextReview}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audits Tab */}
      {activeTab === 'audits' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Audit #', 'Title', 'Auditor', 'Date', 'Status', 'Score', 'Findings', 'Region'].map((h) => (
                  <th key={h} style={{ color: '#64748b', padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDITS.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                  onClick={() => { setSelectedItem(a); setShowModal(true); }}>
                  <td style={{ color: '#60a5fa', padding: '12px 14px', fontSize: '12px', fontWeight: 600 }}>{a.number}</td>
                  <td style={{ color: '#e2e8f0', padding: '12px 14px', fontSize: '13px' }}>{a.title}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 14px', fontSize: '12px' }}>{a.auditor}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 14px', fontSize: '12px' }}>{a.date}</td>
                  <td style={{ padding: '12px 14px' }}>{renderBadge(a.status)}</td>
                  <td style={{ color: a.score !== null ? (a.score >= 90 ? '#22c55e' : a.score >= 75 ? '#eab308' : '#ef4444') : '#64748b', padding: '12px 14px', fontSize: '13px', fontWeight: 700 }}>{a.score !== null ? `${a.score}%` : '—'}</td>
                  <td style={{ color: a.openFindings > 0 ? '#f97316' : '#94a3b8', padding: '12px 14px', fontSize: '13px' }}>{a.openFindings}/{a.findings}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 14px', fontSize: '12px' }}>{a.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '14px' }}>
          {MOCK_INCIDENTS.map((i) => (
            <div key={i.id} onClick={() => { setSelectedItem(i); setShowModal(true); }}
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${SEV_COLORS[i.severity]}33`, borderRadius: '14px', padding: '18px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{i.title}</h3>
                  <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '11px' }}>{i.number} • {i.reportedBy}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: SEV_COLORS[i.severity], fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', background: `${SEV_COLORS[i.severity]}22`, padding: '3px 8px', borderRadius: '6px' }}>{i.severity}</span>
                  {renderBadge(i.status)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '10px' }}>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '9px' }}>RECORDS</p>
                  <p style={{ color: i.affectedRecords > 0 ? '#ef4444' : '#22c55e', margin: '2px 0 0', fontSize: '13px', fontWeight: 700 }}>{i.affectedRecords.toLocaleString()}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '9px' }}>CATEGORY</p>
                  <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '11px' }}>{CAT_ICONS[i.category]} {i.category.replace(/_/g, ' ')}</p>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px' }}>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '9px' }}>REGION</p>
                  <p style={{ color: '#94a3b8', margin: '2px 0 0', fontSize: '12px' }}>{i.region}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Finding', 'Audit', 'Severity', 'Remediation', 'Assigned To', 'Due Date'].map((h) => (
                  <th key={h} style={{ color: '#64748b', padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_FINDINGS.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ color: '#e2e8f0', padding: '12px 14px', fontSize: '13px', maxWidth: '300px' }}>{f.description}</td>
                  <td style={{ color: '#60a5fa', padding: '12px 14px', fontSize: '12px', fontWeight: 600 }}>{f.audit}</td>
                  <td style={{ padding: '12px 14px' }}><span style={{ color: SEV_COLORS[f.severity], fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', background: `${SEV_COLORS[f.severity]}22`, padding: '3px 8px', borderRadius: '6px' }}>{f.severity}</span></td>
                  <td style={{ padding: '12px 14px' }}><span style={{ color: REM_COLORS[f.remediation], fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', background: `${REM_COLORS[f.remediation]}22`, padding: '3px 8px', borderRadius: '6px' }}>{f.remediation.replace(/_/g, ' ')}</span></td>
                  <td style={{ color: '#94a3b8', padding: '12px 14px', fontSize: '12px' }}>{f.assignedTo}</td>
                  <td style={{ color: '#94a3b8', padding: '12px 14px', fontSize: '12px' }}>{f.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', maxWidth: '560px', width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '18px', fontWeight: 700 }}>{selectedItem.name || selectedItem.title || selectedItem.number || 'Details'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>✕ Close</button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              {Object.entries(selectedItem).filter(([k]) => !['id', 'requirements', 'findings'].includes(k)).map(([key, val]) => (
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

export default EnterpriseComplianceDashboardPage;
