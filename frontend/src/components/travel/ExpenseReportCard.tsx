// ExpenseReportCard — Glassmorphism card for expense report display with line items
import React, { useState } from 'react';

interface ExpenseLineItem {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receiptAttached: boolean;
  isCompliant: boolean;
}

interface ExpenseReportCardProps {
  reportNumber: string;
  employeeName: string;
  department: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  lineItems: ExpenseLineItem[];
  subtotal: number;
  totalAmount: number;
  paymentMethod: string;
  complianceScore: number;
  submittedAt: string | null;
  reimbursedAt: string | null;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
  submitted: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
  under_review: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  approved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  reimbursed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

const categoryIcons: Record<string, string> = {
  airfare: '✈️', hotel: '🏨', ground_transport: '🚗', meals: '🍽️', client_entertainment: '🥂',
  conference: '🎤', office_supplies: '📦', mileage: '🛣️', miscellaneous: '📋',
};

const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const ExpenseReportCard: React.FC<ExpenseReportCardProps> = ({
  reportNumber, employeeName, department, title, periodStart, periodEnd, status,
  lineItems, subtotal, totalAmount, paymentMethod, complianceScore, submittedAt, reimbursedAt,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sc = statusColors[status] || statusColors.draft;
  const receiptCount = lineItems.filter((l) => l.receiptAttached).length;
  const compliantCount = lineItems.filter((l) => l.isCompliant).length;

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
        <div>
          <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '14px', fontWeight: 700 }}>{title}</h3>
          <p style={{ color: '#64748b', margin: '3px 0 0', fontSize: '12px' }}>{reportNumber} • {employeeName} ({department})</p>
        </div>
        <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Period & Total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#64748b', fontSize: '12px' }}>📅 {periodStart} → {periodEnd}</span>
        <span style={{ color: '#60a5fa', fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalAmount)}</span>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Items</p>
          <p style={{ color: '#e2e8f0', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{lineItems.length}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Receipts</p>
          <p style={{ color: receiptCount === lineItems.length ? '#22c55e' : '#eab308', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{receiptCount}/{lineItems.length}</p>
        </div>
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '10px' }}>Compliance</p>
          <p style={{ color: complianceScore === 100 ? '#22c55e' : complianceScore >= 80 ? '#eab308' : '#ef4444', margin: '2px 0 0', fontSize: '14px', fontWeight: 700 }}>{complianceScore}%</p>
        </div>
      </div>

      {/* Expanded Line Items */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 8px', fontSize: '12px', fontWeight: 600 }}>🧾 Line Items</p>
          {lineItems.map((item) => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              opacity: item.isCompliant ? 1 : 0.8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{categoryIcons[item.category] || '📋'}</span>
                <div>
                  <p style={{ color: '#e2e8f0', margin: 0, fontSize: '12px' }}>{item.description}</p>
                  <p style={{ color: '#64748b', margin: '1px 0 0', fontSize: '10px' }}>{item.date} • {item.category.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.receiptAttached && <span style={{ color: '#22c55e', fontSize: '12px' }}>📎</span>}
                {!item.isCompliant && <span style={{ color: '#ef4444', fontSize: '12px' }}>⚠️</span>}
                <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{formatCurrency(item.amount)}</span>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Payment: {paymentMethod.replace(/_/g, ' ')}</span>
            <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 700 }}>Total: {formatCurrency(totalAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseReportCard;
