// ProcurementActivityTimeline — Vertical timeline showing procurement lifecycle events
import React from 'react';

interface TimelineEvent {
  id: string;
  type: 'po_created' | 'po_approved' | 'po_sent' | 'po_received' | 'invoice_received' | 'invoice_matched' | 'invoice_paid' | 'invoice_overdue' | 'contract_expiring' | 'risk_flag';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  amount?: number;
  currency?: string;
  priority: 'normal' | 'warning' | 'critical';
}

const eventTypeConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
  po_created: { icon: '📋', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.15)' },
  po_approved: { icon: '✅', color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.15)' },
  po_sent: { icon: '📤', color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.15)' },
  po_received: { icon: '📦', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)' },
  invoice_received: { icon: '🧾', color: '#f472b6', bgColor: 'rgba(244, 114, 182, 0.15)' },
  invoice_matched: { icon: '🔗', color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.15)' },
  invoice_paid: { icon: '💰', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
  invoice_overdue: { icon: '🚨', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  contract_expiring: { icon: '⏰', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
  risk_flag: { icon: '⚠️', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
};

const MOCK_TIMELINE: TimelineEvent[] = [
  {
    id: 'EVT-001', type: 'po_created', title: 'Purchase Order Created',
    description: 'PO-2026-1004 submitted by Supply Chain Team for Nordic Logistics cross-border shipment.',
    timestamp: '2026-08-10T13:00:00Z', actor: 'Supply Chain Team', amount: 29100, currency: 'SEK', priority: 'normal',
  },
  {
    id: 'EVT-002', type: 'contract_expiring', title: 'Contract Expiring — 30 Days',
    description: 'SaaS Platform License Agreement with CloudPeak Systems expires Aug 31, 2026. Renewal action required.',
    timestamp: '2026-08-01T00:00:00Z', actor: 'System', amount: 840000, currency: 'EUR', priority: 'warning',
  },
  {
    id: 'EVT-003', type: 'invoice_overdue', title: 'Invoice Overdue — Escalated',
    description: 'NL-INV-2026-1190 from Nordic Logistics is 18 days past due. Payment escalated to AP team.',
    timestamp: '2026-08-19T09:00:00Z', actor: 'Accounts Payable', amount: 29100, currency: 'SEK', priority: 'critical',
  },
  {
    id: 'EVT-004', type: 'invoice_received', title: 'Invoice Received — Pending Match',
    description: 'CP-INV-2026-0234 received from CloudPeak Systems for enterprise license. Awaiting three-way match.',
    timestamp: '2026-08-08T08:30:00Z', actor: 'AP Automation', amount: 142800, currency: 'EUR', priority: 'normal',
  },
  {
    id: 'EVT-005', type: 'po_received', title: 'Goods Received — Verified',
    description: 'PO-2026-1003 from Apex Facility Services completed. Q3 deep clean and HVAC service delivered.',
    timestamp: '2026-07-23T16:00:00Z', actor: 'Facilities Manager', amount: 33550, currency: 'AUD', priority: 'normal',
  },
  {
    id: 'EVT-006', type: 'invoice_paid', title: 'Payment Processed',
    description: 'TN-INV-2026-0891 from TechNova Solutions paid via wire transfer. Three-way match confirmed.',
    timestamp: '2026-08-12T09:00:00Z', actor: 'Treasury Operations', amount: 92595.50, currency: 'USD', priority: 'normal',
  },
  {
    id: 'EVT-007', type: 'po_approved', title: 'Purchase Order Approved',
    description: 'PO-2026-1001 for TechNova hardware batch approved by CFO Office. 50 units (laptops + monitors).',
    timestamp: '2026-08-02T14:30:00Z', actor: 'CFO Office', amount: 92595.50, currency: 'USD', priority: 'normal',
  },
  {
    id: 'EVT-008', type: 'risk_flag', title: 'Vendor Risk Review Triggered',
    description: 'Sakura IT Services flagged for outstanding security questionnaire. Under review status applied.',
    timestamp: '2026-08-05T11:00:00Z', actor: 'Procurement Compliance', priority: 'warning',
  },
];

function formatAmount(amount?: number, currency?: string): string {
  if (!amount) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ProcurementActivityTimelineProps {
  events?: TimelineEvent[];
}

const ProcurementActivityTimeline: React.FC<ProcurementActivityTimelineProps> = ({ events = MOCK_TIMELINE }) => {
  return (
    <div style={{ padding: '8px 0' }}>
      {events.map((event, idx) => {
        const config = eventTypeConfig[event.type] || eventTypeConfig.po_created;
        const isLast = idx === events.length - 1;
        return (
          <div key={event.id} style={{ display: 'flex', gap: '16px', marginBottom: isLast ? 0 : '4px' }}>
            {/* Timeline Line + Dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '32px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', background: config.bgColor,
                border: `2px solid ${config.color}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '14px', flexShrink: 0, zIndex: 1,
              }}>
                {config.icon}
              </div>
              {!isLast && (
                <div style={{
                  width: '2px', flex: 1, minHeight: '20px',
                  background: `linear-gradient(180deg, ${config.color}44, ${config.color}11)`,
                }} />
              )}
            </div>

            {/* Event Content */}
            <div style={{
              flex: 1, background: event.priority === 'critical' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${event.priority === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '12px', padding: '12px 16px', marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <h4 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 600 }}>{event.title}</h4>
                <span style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p style={{ color: '#94a3b8', margin: '0 0 6px', fontSize: '12px', lineHeight: '1.5' }}>{event.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '11px' }}>👤 {event.actor}</span>
                {event.amount && (
                  <span style={{
                    color: config.color, fontSize: '12px', fontWeight: 600,
                    background: config.bgColor, padding: '2px 8px', borderRadius: '6px',
                  }}>
                    {formatAmount(event.amount, event.currency)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProcurementActivityTimeline;
