import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Search,
  Filter,
  Download,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Server,
  Key,
  Fingerprint,
  Database,
  Network,
  Activity,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  FileWarning,
  Layers,
  Target,
  Terminal,
  Bug,
  Flame,
  ScanLine,
  KeyRound,
  Shield,
  Info,
  X,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

/* ─────────────────────────── Types ─────────────────────────── */

interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  sourceIp: string;
  targetService: string;
  description: string;
  mitreId: string;
  status: 'ACTIVE' | 'MITIGATED' | 'INVESTIGATING' | 'RESOLVED';
  assignee: string;
  confidenceScore: number;
}

interface ZTSession {
  id: string;
  userId: string;
  userName: string;
  deviceFingerprint: string;
  trustScore: number;
  mfaVerified: boolean;
  geoLocation: string;
  lastAccess: string;
  riskIndicators: string[];
  policyViolations: number;
  networkSegment: string;
  encryptedTunnelActive: boolean;
  enclaveAttested: boolean;
}

interface EncryptionKey {
  id: string;
  keyAlias: string;
  algorithm: string;
  keySize: number;
  createdAt: string;
  expiresAt: string;
  lastRotated: string;
  rotationPolicy: string;
  usageCount: number;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'REVOKED';
  pqResistant: boolean;
}

interface ComplianceRule {
  id: string;
  framework: string;
  ruleId: string;
  title: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_APPLICABLE';
  lastScan: string;
  riskRating: string;
  remediation: string;
}

interface SimTick {
  tick: number;
  activeThreats: number;
  ztSessions: number;
  avgTrustScore: number;
  blockedRequests: number;
  pqKeyRotations: number;
  complianceScore: number;
  enclaveAttestations: number;
  anomaliesDetected: number;
}

/* ─────────────────────── Seed Data ─────────────────────────── */

const SEED_THREATS: ThreatEvent[] = [
  { id: 'THR-001', timestamp: '2026-08-20T14:32:00Z', severity: 'CRITICAL', category: 'Credential Stuffing', sourceIp: '185.220.101.42', targetService: 'Payroll Auth Gateway', description: 'Mass credential stuffing attempt against SSO login endpoint — 12,400 requests/min from Tor exit nodes targeting payroll admin accounts.', mitreId: 'T1110.004', status: 'ACTIVE', assignee: 'SOC-Team-A', confidenceScore: 97.3, },
  { id: 'THR-002', timestamp: '2026-08-20T14:28:00Z', severity: 'HIGH', category: 'Lateral Movement', sourceIp: '10.0.4.117', targetService: 'Compensation DB', description: 'Suspicious lateral movement detected from compromised contractor workstation to compensation database subnet. ZT microsegmentation blocked.', mitreId: 'T1021.001', status: 'MITIGATED', assignee: 'SOC-Team-B', confidenceScore: 91.8, },
  { id: 'THR-003', timestamp: '2026-08-20T14:15:00Z', severity: 'MEDIUM', category: 'Data Exfiltration', sourceIp: '10.0.2.89', targetService: 'Employee PII Vault', description: 'Anomalous data volume transfer from payroll export service to external staging endpoint. DLP policies triggered automatic quarantine.', mitreId: 'T1041', status: 'INVESTIGATING', assignee: 'SOC-Team-A', confidenceScore: 78.5, },
  { id: 'THR-004', timestamp: '2026-08-20T13:55:00Z', severity: 'HIGH', category: 'Privilege Escalation', sourceIp: '10.0.1.203', targetService: 'IAM Admin Console', description: 'Attempted vertical privilege escalation via JWT claim manipulation on service account. ZT policy enforcement denied access.', mitreId: 'T1078.004', status: 'MITIGATED', assignee: 'SOC-Team-C', confidenceScore: 94.2, },
  { id: 'THR-005', timestamp: '2026-08-20T13:40:00Z', severity: 'LOW', category: 'Reconnaissance', sourceIp: '203.0.113.55', targetService: 'Public API Gateway', description: 'Port scanning and service enumeration detected on public-facing API endpoints. Standard automated scanning — no exploitation observed.', mitreId: 'T1046', status: 'RESOLVED', assignee: 'SOC-Team-B', confidenceScore: 62.1, },
  { id: 'THR-006', timestamp: '2026-08-20T13:20:00Z', severity: 'CRITICAL', category: 'Insider Threat', sourceIp: '10.0.3.44', targetService: 'Tax Filing Module', description: 'Behavioral analytics flagged potential insider threat — after-hours access to tax filing module with bulk PDF downloads. UEBA score spiked.', mitreId: 'T1078.002', status: 'INVESTIGATING', assignee: 'SOC-Team-A', confidenceScore: 88.7, },
  { id: 'THR-007', timestamp: '2026-08-20T12:50:00Z', severity: 'MEDIUM', category: 'Supply Chain', sourceIp: '172.16.0.88', targetService: 'Vendor Integration API', description: 'Third-party vendor SDK update flagged by software composition analysis — known backdoor in dependency chain. Auto-rollback initiated.', mitreId: 'T1195.002', status: 'MITIGATED', assignee: 'SOC-Team-C', confidenceScore: 95.1, },
  { id: 'THR-008', timestamp: '2026-08-20T12:10:00Z', severity: 'INFO', category: 'Policy Update', sourceIp: 'N/A', targetService: 'ZT Policy Engine', description: 'Zero-trust policy engine updated — 3 new microsegmentation rules deployed for contractor access zone. No security impact.', mitreId: 'N/A', status: 'RESOLVED', assignee: 'Platform-Team', confidenceScore: 100, },
];

const SEED_SESSIONS: ZTSession[] = [
  { id: 'SES-8801', userId: 'USR-4021', userName: 'Priya Sharma', deviceFingerprint: 'Win-11-TPM2.0-A3F2', trustScore: 96, mfaVerified: true, geoLocation: 'Mumbai, IN', lastAccess: '2 min ago', riskIndicators: [], policyViolations: 0, networkSegment: 'Corporate-Finance', encryptedTunnelActive: true, enclaveAttested: true },
  { id: 'SES-8802', userId: 'USR-1187', userName: 'Marcus Chen', deviceFingerprint: 'Mac-M4-SecureEnclave-B7D1', trustScore: 92, mfaVerified: true, geoLocation: 'San Francisco, US', lastAccess: '5 min ago', riskIndicators: ['New device fingerprint'], policyViolations: 0, networkSegment: 'Corporate-HR', encryptedTunnelActive: true, enclaveAttested: true },
  { id: 'SES-8803', userId: 'USR-5534', userName: 'Elena Volkov', deviceFingerprint: 'Linux-Titan-C9E4', trustScore: 78, mfaVerified: true, geoLocation: 'Berlin, DE', lastAccess: '12 min ago', riskIndicators: ['VPN protocol downgrade detected', 'Geo-velocity anomaly'], policyViolations: 1, networkSegment: 'Remote-EU', encryptedTunnelActive: true, enclaveAttested: false },
  { id: 'SES-8804', userId: 'USR-7712', userName: 'Raj Patel (Contractor)', deviceFingerprint: 'Win-10-Unknown-F1A3', trustScore: 54, mfaVerified: false, geoLocation: 'Unknown (TOR)', lastAccess: '18 min ago', riskIndicators: ['TOR exit node detected', 'MFA bypass attempted', 'Non-compliant OS version', 'Root detection triggered'], policyViolations: 3, networkSegment: 'Contractor-Untrusted', encryptedTunnelActive: false, enclaveAttested: false },
  { id: 'SES-8805', userId: 'USR-2290', userName: 'Aisha Okafor', deviceFingerprint: 'iOS-18-SE-L8K2', trustScore: 88, mfaVerified: true, geoLocation: 'Lagos, NG', lastAccess: '1 min ago', riskIndicators: ['Mobile device — limited attestation'], policyViolations: 0, networkSegment: 'Remote-Africa', encryptedTunnelActive: true, enclaveAttested: false },
];

const SEED_KEYS: EncryptionKey[] = [
  { id: 'KEY-001', keyAlias: 'payroll-master-2026', algorithm: 'AES-256-GCM', keySize: 256, createdAt: '2026-01-15', expiresAt: '2027-01-15', lastRotated: '2026-08-01', rotationPolicy: '90-day', usageCount: 1843200, status: 'ACTIVE', pqResistant: false },
  { id: 'KEY-002', keyAlias: 'pq-lattice-hr-vault', algorithm: 'CRYSTALS-Kyber-1024', keySize: 1024, createdAt: '2026-06-01', expiresAt: '2028-06-01', lastRotated: '2026-08-15', rotationPolicy: '60-day', usageCount: 432100, status: 'ACTIVE', pqResistant: true },
  { id: 'KEY-003', keyAlias: 'pii-shield-employee', algorithm: 'AES-256-GCM', keySize: 256, createdAt: '2025-11-01', expiresAt: '2026-11-01', lastRotated: '2026-07-20', rotationPolicy: '90-day', usageCount: 3290400, status: 'EXPIRING', pqResistant: false },
  { id: 'KEY-004', keyAlias: 'tax-filing-signing', algorithm: 'ECDSA-P384', keySize: 384, createdAt: '2026-03-10', expiresAt: '2027-03-10', lastRotated: '2026-08-10', rotationPolicy: '30-day', usageCount: 876500, status: 'ACTIVE', pqResistant: false },
  { id: 'KEY-005', keyAlias: 'pq-sphincs-compliance', algorithm: 'SPHINCS+-SHA2-256f', keySize: 256, createdAt: '2026-07-01', expiresAt: '2028-07-01', lastRotated: '2026-08-20', rotationPolicy: '30-day', usageCount: 98700, status: 'ACTIVE', pqResistant: true },
  { id: 'KEY-006', keyAlias: 'vendor-integration-hmac', algorithm: 'HMAC-SHA384', keySize: 384, createdAt: '2024-09-15', expiresAt: '2025-09-15', lastRotated: '2024-09-15', rotationPolicy: 'Annual', usageCount: 5620000, status: 'EXPIRED', pqResistant: false },
];

const SEED_COMPLIANCE: ComplianceRule[] = [
  { id: 'CMP-001', framework: 'NIST CSF 2.0', ruleId: 'PR.AC-7', title: 'Least Privilege Enforcement', description: 'All users, devices, and applications are authenticated and authorized before accessing payroll resources. Permissions follow zero-trust least-privilege model.', status: 'PASS', lastScan: '2026-08-20T10:00:00Z', riskRating: 'LOW', remediation: 'N/A — compliant.' },
  { id: 'CMP-002', framework: 'NIST CSF 2.0', ruleId: 'PR.DS-1', title: 'Data-at-Rest Encryption', description: 'All employee PII and compensation data encrypted with AES-256-GCM at rest across all database clusters and backup storage.', status: 'PASS', lastScan: '2026-08-20T10:00:00Z', riskRating: 'LOW', remediation: 'N/A — compliant.' },
  { id: 'CMP-003', framework: 'SOC 2 Type II', ruleId: 'CC6.1', title: 'Logical Access Controls', description: 'Role-based access control enforced across all payroll microservices. Service mesh mTLS with automatic certificate rotation.', status: 'PASS', lastScan: '2026-08-20T10:00:00Z', riskRating: 'LOW', remediation: 'N/A — compliant.' },
  { id: 'CMP-004', framework: 'PCI DSS 4.0', ruleId: 'Req-3.5.1', title: 'Cryptographic Key Management', description: 'Payment card data encryption keys managed in FIPS 140-3 Level 3 HSM with dual-control access and split knowledge procedures.', status: 'FAIL', lastScan: '2026-08-20T10:00:00Z', riskRating: 'HIGH', remediation: 'Rotate expired vendor-integration-hmac key and migrate to PQ-resistant algorithm. 1 overdue rotation detected.' },
  { id: 'CMP-005', framework: 'ISO 27001', ruleId: 'A.8.24', title: 'Post-Quantum Cryptography Readiness', description: 'Organization maintains inventory of quantum-vulnerable algorithms and roadmap for CRYSTALS-Kyber and SPHINCS+ adoption across all critical systems.', status: 'PARTIAL', lastScan: '2026-08-20T10:00:00Z', riskRating: 'MEDIUM', remediation: 'Payroll master key (AES-256-GCM) migration to PQ-hybrid scheme in progress. Target completion: Q4 2026.' },
  { id: 'CMP-006', framework: 'SOC 2 Type II', ruleId: 'CC7.2', title: 'Continuous Security Monitoring', description: 'Real-time SIEM correlation, UEBA behavioral analytics, and automated threat response playbooks operational across all production environments.', status: 'PASS', lastScan: '2026-08-20T10:00:00Z', riskRating: 'LOW', remediation: 'N/A — compliant.' },
  { id: 'CMP-007', framework: 'NIST CSF 2.0', ruleId: 'ID.AM-5', title: 'Asset Inventory & Software Composition', description: 'Complete SBOM maintained for all production services. Automated scanning for vulnerable dependencies with <24hr SLA for critical CVEs.', status: 'PASS', lastScan: '2026-08-20T10:00:00Z', riskRating: 'LOW', remediation: 'N/A — compliant.' },
  { id: 'CMP-008', framework: 'PCI DSS 4.0', ruleId: 'Req-11.6.1', title: 'Tamper Detection on Payment Pages', description: 'Payment page integrity monitoring via CSP headers, subresource integrity, and runtime application self-protection (RASP) agents.', status: 'PASS', lastScan: '2026-08-20T10:00:00Z', riskRating: 'LOW', remediation: 'N/A — compliant.' },
];

/* ─────────────────────── Utility Helpers ─────────────────────── */

function severityColor(sev: string): string {
  switch (sev) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'INFO': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'MITIGATED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'INVESTIGATING': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'RESOLVED': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'PASS': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'FAIL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'PARTIAL': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

function trustScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────── Toast Context ───────────────────────── */

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

let toastIdSeq = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdSeq;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, addToast, dismissToast };
}

/* ─────────────────── Toast Renderer ───────────────────────── */

function ToastRenderer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl text-sm font-medium animate-slide-in ${
            t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' :
            t.type === 'error' ? 'bg-red-950/90 border-red-500/30 text-red-300' :
            t.type === 'warning' ? 'bg-amber-950/90 border-amber-500/30 text-amber-300' :
            'bg-slate-800/90 border-slate-700/50 text-slate-200'
          }`}
        >
          <div className="flex-1">{t.message}</div>
          <button onClick={() => dismiss(t.id)} className="text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ──────────────── Simulation Sandbox Hook ──────────────────── */

function useSimulation() {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [tickCount, setTickCount] = useState(0);
  const [history, setHistory] = useState<SimTick[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateTick = useCallback((prev: SimTick | null): SimTick => {
    const base = prev || { tick: 0, activeThreats: 3, ztSessions: 5, avgTrustScore: 84.2, blockedRequests: 127, pqKeyRotations: 1, complianceScore: 87.5, enclaveAttestations: 12, anomaliesDetected: 2 };
    const jitter = (v: number, range: number) => Math.max(0, v + (Math.random() * range * 2 - range));
    return {
      tick: base.tick + 1,
      activeThreats: Math.round(jitter(base.activeThreats, 1.5)),
      ztSessions: Math.round(jitter(base.ztSessions, 2)),
      avgTrustScore: Math.round(jitter(base.avgTrustScore, 3) * 10) / 10,
      blockedRequests: Math.round(jitter(base.blockedRequests, 25)),
      pqKeyRotations: Math.round(jitter(base.pqKeyRotations, 0.5)),
      complianceScore: Math.round(jitter(base.complianceScore, 1.5) * 10) / 10,
      enclaveAttestations: Math.round(jitter(base.enclaveAttestations, 3)),
      anomaliesDetected: Math.round(jitter(base.anomaliesDetected, 1)),
    };
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    pause();
    setTickCount(0);
    setHistory([]);
  }, [pause]);

  const toggleSpeed = useCallback(() => {
    setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1));
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ms = speed === 1 ? 1000 : speed === 2 ? 500 : 250;
    intervalRef.current = setInterval(() => {
      setHistory((prev) => {
        const last = prev.length > 0 ? prev[prev.length - 1] : null;
        const next = generateTick(last);
        return [...prev.slice(-59), next];
      });
      setTickCount((c) => c + 1);
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, speed, generateTick]);

  return { isRunning, speed, tickCount, history, start, pause, reset, toggleSpeed, latestTick: history.length > 0 ? history[history.length - 1] : null };
}

/* ──────────────── Mini Sparkline ────────────────────────── */

function Sparkline({ data, color = '#10b981', height = 40, width = 160 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-slate-800/50 rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

/* ──────────────── Vertical Bar Chart ───────────────────── */

function VerticalBarChart({ values, labels, maxHeight = 120 }: { values: number[]; labels: string[]; maxHeight?: number }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: maxHeight }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div
            className="w-full rounded-t-md transition-all duration-500"
            style={{ height: `${(v / max) * maxHeight * 0.85}px`, backgroundColor: `hsl(${142 + i * 20}, 70%, ${45 + i * 5}%)` }}
          />
          <span className="text-[9px] text-slate-500 truncate w-full text-center">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function EnterpriseCybersecuritySOCPage() {
  const { toasts, addToast, dismissToast } = useToasts();
  const sim = useSimulation();

  const [activeTab, setActiveTab] = useState<'threats' | 'zt-sessions' | 'encryption' | 'compliance' | 'simulation'>('threats');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [modalData, setModalData] = useState<ThreatEvent | ZTSession | EncryptionKey | ComplianceRule | null>(null);
  const [modalType, setModalType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'severity' | 'confidence'>('timestamp');

  /* ───── Derived Stats ───── */
  const activeThreatCount = SEED_THREATS.filter((t) => t.status === 'ACTIVE').length;
  const criticalCount = SEED_THREATS.filter((t) => t.severity === 'CRITICAL').length;
  const avgTrust = Math.round(SEED_SESSIONS.reduce((a, s) => a + s.trustScore, 0) / SEED_SESSIONS.length * 10) / 10;
  const pqKeyCount = SEED_KEYS.filter((k) => k.pqResistant).length;
  const compliancePass = SEED_COMPLIANCE.filter((c) => c.status === 'PASS').length;
  const complianceTotal = SEED_COMPLIANCE.length;
  const compliancePct = Math.round((compliancePass / complianceTotal) * 100);

  /* ───── Filter + Sort ───── */
  const filteredThreats = useMemo(() => {
    let list = [...SEED_THREATS];
    if (severityFilter !== 'ALL') list = list.filter((t) => t.severity === severityFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.sourceIp.includes(q) || t.targetService.toLowerCase().includes(q));
    }
    if (sortBy === 'severity') {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      list.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
    } else if (sortBy === 'confidence') {
      list.sort((a, b) => b.confidenceScore - a.confidenceScore);
    } else {
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return list;
  }, [severityFilter, searchQuery, sortBy]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return SEED_SESSIONS;
    const q = searchQuery.toLowerCase();
    return SEED_SESSIONS.filter((s) => s.userName.toLowerCase().includes(q) || s.userId.toLowerCase().includes(q) || s.networkSegment.toLowerCase().includes(q) || s.geoLocation.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredKeys = useMemo(() => {
    if (!searchQuery) return SEED_KEYS;
    const q = searchQuery.toLowerCase();
    return SEED_KEYS.filter((k) => k.keyAlias.toLowerCase().includes(q) || k.algorithm.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredCompliance = useMemo(() => {
    if (!searchQuery) return SEED_COMPLIANCE;
    const q = searchQuery.toLowerCase();
    return SEED_COMPLIANCE.filter((c) => c.title.toLowerCase().includes(q) || c.framework.toLowerCase().includes(q) || c.ruleId.toLowerCase().includes(q));
  }, [searchQuery]);

  /* ───── CSV Export Handlers ───── */
  const handleExportThreats = () => {
    exportToCsv(filteredThreats.map((t) => ({ id: t.id, severity: t.severity, category: t.category, sourceIp: t.sourceIp, target: t.targetService, status: t.status, mitre: t.mitreId, confidence: t.confidenceScore, assignee: t.assignee })), 'soc-threats.csv');
    addToast('Threat intelligence exported to CSV', 'success');
  };

  const handleExportSessions = () => {
    exportToCsv(filteredSessions.map((s) => ({ id: s.id, user: s.userName, trustScore: s.trustScore, mfa: s.mfaVerified, geo: s.geoLocation, segment: s.networkSegment, violations: s.policyViolations, enclave: s.enclaveAttested })), 'zt-sessions.csv');
    addToast('Zero-trust sessions exported to CSV', 'success');
  };

  const handleExportKeys = () => {
    exportToCsv(filteredKeys.map((k) => ({ id: k.id, alias: k.keyAlias, algorithm: k.algorithm, size: k.keySize, status: k.status, pqResistant: k.pqResistant, expires: k.expiresAt, usage: k.usageCount })), 'encryption-keys.csv');
    addToast('Encryption key inventory exported to CSV', 'success');
  };

  const handleExportCompliance = () => {
    exportToCsv(filteredCompliance.map((c) => ({ id: c.id, framework: c.framework, rule: c.ruleId, title: c.title, status: c.status, risk: c.riskRating, remediation: c.remediation })), 'compliance-report.csv');
    addToast('Compliance report exported to CSV', 'success');
  };

  /* ───── Modal Opener ───── */
  const openThreatModal = (t: ThreatEvent) => { setModalData(t); setModalType('threat'); };
  const openSessionModal = (s: ZTSession) => { setModalData(s); setModalType('session'); };
  const openKeyModal = (k: EncryptionKey) => { setModalData(k); setModalType('key'); };
  const openComplianceModal = (c: ComplianceRule) => { setModalData(c); setModalType('compliance'); };

  /* ───── Tabs Config ───── */
  const tabs = [
    { key: 'threats' as const, label: 'Threat Intelligence', icon: ShieldAlert, count: filteredThreats.length },
    { key: 'zt-sessions' as const, label: 'ZT Sessions', icon: ShieldCheck, count: filteredSessions.length },
    { key: 'encryption' as const, label: 'Encryption Keys', icon: KeyRound, count: filteredKeys.length },
    { key: 'compliance' as const, label: 'Compliance Scan', icon: CheckCircle2, count: `${compliancePct}%` },
    { key: 'simulation' as const, label: 'Live Sandbox', icon: Activity, count: sim.isRunning ? 'LIVE' : 'IDLE' },
  ];

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <ToastRenderer toasts={toasts} dismiss={dismissToast} />

      {/* ──── Executive Header ──── */}
      <header className="max-w-[1400px] mx-auto mb-8 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-red-500/20 text-red-300 text-xs px-3 py-1 rounded-full font-semibold border border-red-500/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> PaySphere Security Operations Center
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Zero-Trust Enforced
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-red-200 bg-clip-text text-transparent">
              Enterprise Cybersecurity & Zero-Trust SOC Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              Real-time threat detection, zero-trust session monitoring, post-quantum encryption key management, continuous compliance scanning, and live attack simulation sandbox for PaySphere's payroll infrastructure.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => { addToast('SOC dashboard refreshed — all feeds up to date', 'success'); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-slate-700">
              <RefreshCw className="w-4 h-4" /> Refresh Feeds
            </button>
            <button onClick={handleExportThreats} className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-red-600/20 transition flex items-center gap-2 text-sm border border-red-400/20">
              <Download className="w-4 h-4" /> Export SOC Report
            </button>
          </div>
        </div>
      </header>

      {/* ──── KPI Cards ──── */}
      <main className="max-w-[1400px] mx-auto space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Active Threats', value: String(activeThreatCount), sub: `${criticalCount} critical`, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { label: 'ZT Sessions', value: String(SEED_SESSIONS.length), sub: `${avgTrust}% avg trust`, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Blocked Requests', value: '1,247', sub: 'Last 24 hours', icon: ShieldOff, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'PQ-Ready Keys', value: String(pqKeyCount), sub: `of ${SEED_KEYS.length} total`, icon: Key, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
            { label: 'Compliance', value: `${compliancePct}%`, sub: `${compliancePass}/${complianceTotal} rules`, icon: CheckCircle2, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
            { label: 'Enclaves', value: '12', sub: 'Attested SGX', icon: Server, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} border rounded-2xl p-4 backdrop-blur-md`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpi.value}</div>
              <div className={`${kpi.color} text-[11px] mt-1 font-medium`}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ──── Tab Navigation ──── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.key ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className="text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === 'threats' && (
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs px-3 py-2.5 focus:outline-none focus:border-red-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>
            )}
            {activeTab === 'threats' && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs px-3 py-2.5 focus:outline-none focus:border-red-500"
              >
                <option value="timestamp">Newest First</option>
                <option value="severity">By Severity</option>
                <option value="confidence">By Confidence</option>
              </select>
            )}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-red-500 transition"
              />
            </div>
            {activeTab === 'threats' && (
              <button onClick={handleExportThreats} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
            {activeTab === 'zt-sessions' && (
              <button onClick={handleExportSessions} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
            {activeTab === 'encryption' && (
              <button onClick={handleExportKeys} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
            {activeTab === 'compliance' && (
              <button onClick={handleExportCompliance} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════ TAB: THREATS ═══════════════════════ */}
        {activeTab === 'threats' && (
          <div className="space-y-4">
            {filteredThreats.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No threats match your filter criteria.</p>
              </div>
            )}
            {filteredThreats.map((threat) => (
              <div
                key={threat.id}
                onClick={() => openThreatModal(threat)}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColor(threat.severity)}`}>{threat.severity}</span>
                      <span className="text-slate-300 text-sm font-semibold">{threat.category}</span>
                      <span className="text-slate-500 text-xs font-mono">{threat.mitreId}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(threat.status)}`}>{threat.status}</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{threat.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {threat.sourceIp}</span>
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {threat.targetService}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(threat.timestamp).toLocaleTimeString()}</span>
                      <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {threat.assignee}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase">Confidence</div>
                      <div className={`text-lg font-black font-mono ${threat.confidenceScore >= 90 ? 'text-red-400' : threat.confidenceScore >= 70 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {threat.confidenceScore}%
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: ZT SESSIONS ═══════════════════════ */}
        {activeTab === 'zt-sessions' && (
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => openSessionModal(session)}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-slate-200 text-sm font-semibold">{session.userName}</span>
                      <span className="text-slate-500 text-xs font-mono">{session.userId}</span>
                      {session.mfaVerified ? (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1"><Fingerprint className="w-3 h-3" /> MFA</span>
                      ) : (
                        <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1"><UserX className="w-3 h-3" /> NO MFA</span>
                      )}
                      {session.enclaveAttested && (
                        <span className="bg-violet-500/20 text-violet-400 text-[10px] font-bold px-2 py-0.5 rounded border border-violet-500/30 flex items-center gap-1"><Server className="w-3 h-3" /> ENCLAVE</span>
                      )}
                      {session.encryptedTunnelActive && (
                        <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1"><Lock className="w-3 h-3" /> ENCRYPTED</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.geoLocation}</span>
                      <span className="flex items-center gap-1"><Network className="w-3 h-3" /> {session.networkSegment}</span>
                      <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {session.deviceFingerprint}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {session.lastAccess}</span>
                    </div>
                    {session.riskIndicators.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {session.riskIndicators.map((ri, i) => (
                          <span key={i} className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full border border-orange-500/20">{ri}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase">Trust Score</div>
                      <div className={`text-2xl font-black font-mono ${trustScoreColor(session.trustScore)}`}>{session.trustScore}</div>
                    </div>
                    {session.policyViolations > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase">Violations</div>
                        <div className="text-lg font-black font-mono text-red-400">{session.policyViolations}</div>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: ENCRYPTION KEYS ═══════════════════════ */}
        {activeTab === 'encryption' && (
          <div className="space-y-4">
            {filteredKeys.map((key) => (
              <div
                key={key.id}
                onClick={() => openKeyModal(key)}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <KeyRound className={`w-4 h-4 ${key.status === 'ACTIVE' ? 'text-emerald-400' : key.status === 'EXPIRING' ? 'text-amber-400' : 'text-red-400'}`} />
                      <span className="text-slate-200 text-sm font-semibold">{key.keyAlias}</span>
                      <span className="text-slate-500 text-xs font-mono">{key.algorithm}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(key.status)}`}>{key.status}</span>
                      {key.pqResistant && (
                        <span className="bg-violet-500/20 text-violet-400 text-[10px] font-bold px-2 py-0.5 rounded border border-violet-500/30 flex items-center gap-1"><Zap className="w-3 h-3" /> PQ-RESISTANT</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                      <span>{key.keySize}-bit</span>
                      <span>Rotated: {key.lastRotated}</span>
                      <span>Expires: {key.expiresAt}</span>
                      <span>Policy: {key.rotationPolicy}</span>
                      <span>{key.usageCount.toLocaleString()} uses</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: COMPLIANCE ═══════════════════════ */}
        {activeTab === 'compliance' && (
          <div className="space-y-4">
            {filteredCompliance.map((rule) => (
              <div
                key={rule.id}
                onClick={() => openComplianceModal(rule)}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">{rule.framework}</span>
                      <span className="text-slate-500 text-xs font-mono">{rule.ruleId}</span>
                      <span className="text-slate-200 text-sm font-semibold">{rule.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(rule.status)}`}>{rule.status}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rule.riskRating === 'HIGH' ? 'bg-red-500/20 text-red-400 border-red-500/30' : rule.riskRating === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                        {rule.riskRating}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{rule.description}</p>
                    {rule.remediation !== 'N/A — compliant.' && (
                      <p className="text-amber-400/80 text-[11px] mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {rule.remediation}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: LIVE SIMULATION ═══════════════════════ */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            {/* Control Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${sim.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-sm font-semibold text-slate-200">
                  Attack Simulation Engine
                </span>
                <span className="text-xs text-slate-500 font-mono">Tick #{sim.tickCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { sim.isRunning ? sim.pause() : sim.start(); addToast(sim.isRunning ? 'Simulation paused' : 'Simulation started — generating attack telemetry', sim.isRunning ? 'info' : 'success'); }}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border ${sim.isRunning ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'}`}
                >
                  {sim.isRunning ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Start</>}
                </button>
                <button onClick={() => { sim.toggleSpeed(); addToast(`Simulation speed: ${sim.speed === 1 ? '2x' : sim.speed === 2 ? '4x' : '1x'}`, 'info'); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700 font-mono">
                  {sim.speed}x
                </button>
                <button onClick={() => { sim.reset(); addToast('Simulation reset — history cleared', 'warning'); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Live Metrics Grid */}
            {sim.latestTick ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Threats', value: sim.latestTick.activeThreats, icon: ShieldAlert, color: 'text-red-400', sparkData: sim.history.map((h) => h.activeThreats) },
                    { label: 'ZT Sessions', value: sim.latestTick.ztSessions, icon: ShieldCheck, color: 'text-emerald-400', sparkData: sim.history.map((h) => h.ztSessions) },
                    { label: 'Blocked Requests', value: sim.latestTick.blockedRequests, icon: ShieldOff, color: 'text-amber-400', sparkData: sim.history.map((h) => h.blockedRequests) },
                    { label: 'Anomalies', value: sim.latestTick.anomaliesDetected, icon: AlertTriangle, color: 'text-orange-400', sparkData: sim.history.map((h) => h.anomaliesDetected) },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">{m.label}</span>
                        <m.icon className={`w-4 h-4 ${m.color}`} />
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={`text-3xl font-black font-mono ${m.color}`}>{m.value}</span>
                        <Sparkline data={m.sparkData} color={m.color === 'text-red-400' ? '#f87171' : m.color === 'text-emerald-400' ? '#34d399' : m.color === 'text-amber-400' ? '#fbbf24' : '#fb923c'} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trust & Compliance Gauges */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Average Trust Score
                    </h3>
                    <div className="relative w-full h-6 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, Math.max(0, sim.latestTick.avgTrustScore))}%`,
                          background: `linear-gradient(90deg, ${sim.latestTick.avgTrustScore >= 80 ? '#10b981' : sim.latestTick.avgTrustScore >= 60 ? '#f59e0b' : '#ef4444'}, ${sim.latestTick.avgTrustScore >= 80 ? '#34d399' : sim.latestTick.avgTrustScore >= 60 ? '#fbbf24' : '#f87171'})`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] text-slate-500">
                      <span>0</span>
                      <span className={`font-mono font-bold ${trustScoreColor(sim.latestTick.avgTrustScore)}`}>{sim.latestTick.avgTrustScore}%</span>
                      <span>100</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Compliance Score
                    </h3>
                    <div className="relative w-full h-6 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, Math.max(0, sim.latestTick.complianceScore))}%`,
                          background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] text-slate-500">
                      <span>0</span>
                      <span className="font-mono font-bold text-cyan-400">{sim.latestTick.complianceScore}%</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                {sim.history.length > 1 && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
                    <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-400" /> Tick History (last {Math.min(10, sim.history.length)} of {sim.history.length})
                    </h3>
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800">
                          <th className="text-left py-2 pr-4">Tick</th>
                          <th className="text-left py-2 pr-4">Threats</th>
                          <th className="text-left py-2 pr-4">Sessions</th>
                          <th className="text-left py-2 pr-4">Trust%</th>
                          <th className="text-left py-2 pr-4">Blocked</th>
                          <th className="text-left py-2 pr-4">PQ Rots</th>
                          <th className="text-left py-2 pr-4">Compliance</th>
                          <th className="text-left py-2">Anomalies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sim.history.slice(-10).reverse().map((row) => (
                          <tr key={row.tick} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                            <td className="py-2 pr-4 text-slate-300">#{row.tick}</td>
                            <td className="py-2 pr-4 text-red-400">{row.activeThreats}</td>
                            <td className="py-2 pr-4 text-emerald-400">{row.ztSessions}</td>
                            <td className={`py-2 pr-4 ${trustScoreColor(row.avgTrustScore)}`}>{row.avgTrustScore}%</td>
                            <td className="py-2 pr-4 text-amber-400">{row.blockedRequests}</td>
                            <td className="py-2 pr-4 text-violet-400">{row.pqKeyRotations}</td>
                            <td className="py-2 pr-4 text-cyan-400">{row.complianceScore}%</td>
                            <td className="py-2 text-orange-400">{row.anomaliesDetected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Press <strong>Start</strong> to begin the attack simulation.</p>
                <p className="text-xs text-slate-600 mt-1">Generates realistic cybersecurity telemetry at {sim.speed}x speed.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════ MODAL ═══════════════════════ */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setModalData(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModalData(null)} className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold">
              <X className="w-5 h-5" />
            </button>

            {/* Threat Modal */}
            {modalType === 'threat' && (() => {
              const t = modalData as ThreatEvent;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                    <h3 className="text-xl font-bold text-white">{t.category}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColor(t.severity)}`}>{t.severity}</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{t.description}</p>
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-xs font-mono">
                    <div><span className="text-slate-500 block">Source IP</span><span className="text-slate-200 font-bold">{t.sourceIp}</span></div>
                    <div><span className="text-slate-500 block">Target Service</span><span className="text-slate-200 font-bold">{t.targetService}</span></div>
                    <div><span className="text-slate-500 block">MITRE ATT&CK</span><span className="text-amber-400 font-bold">{t.mitreId}</span></div>
                    <div><span className="text-slate-500 block">Status</span><span className={`font-bold ${statusColor(t.status).includes('red') ? 'text-red-400' : statusColor(t.status).includes('emerald') ? 'text-emerald-400' : 'text-amber-400'}`}>{t.status}</span></div>
                    <div><span className="text-slate-500 block">Assigned To</span><span className="text-slate-200 font-bold">{t.assignee}</span></div>
                    <div><span className="text-slate-500 block">Confidence</span><span className="text-cyan-400 font-bold">{t.confidenceScore}%</span></div>
                    <div><span className="text-slate-500 block">Timestamp</span><span className="text-slate-200 font-bold">{new Date(t.timestamp).toLocaleString()}</span></div>
                    <div><span className="text-slate-500 block">Event ID</span><span className="text-slate-200 font-bold">{t.id}</span></div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { addToast(`Threat ${t.id} marked as investigating`, 'info'); setModalData(null); }} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-4 py-2 rounded-xl text-xs transition border border-amber-500/30">Investigate</button>
                    <button onClick={() => { addToast(`Threat ${t.id} escalated to CISO`, 'warning'); setModalData(null); }} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl text-xs transition border border-red-500/30">Escalate</button>
                    <button onClick={() => setModalData(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
                  </div>
                </>
              );
            })()}

            {/* Session Modal */}
            {modalType === 'session' && (() => {
              const s = modalData as ZTSession;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    <h3 className="text-xl font-bold text-white">{s.userName}</h3>
                    <span className="text-slate-500 text-xs font-mono">{s.userId}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-xs font-mono">
                    <div><span className="text-slate-500 block">Trust Score</span><span className={`font-bold text-lg ${trustScoreColor(s.trustScore)}`}>{s.trustScore}/100</span></div>
                    <div><span className="text-slate-500 block">MFA Verified</span><span className={s.mfaVerified ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{s.mfaVerified ? 'Yes' : 'No'}</span></div>
                    <div><span className="text-slate-500 block">Geo Location</span><span className="text-slate-200 font-bold">{s.geoLocation}</span></div>
                    <div><span className="text-slate-500 block">Network Segment</span><span className="text-slate-200 font-bold">{s.networkSegment}</span></div>
                    <div><span className="text-slate-500 block">Device Fingerprint</span><span className="text-slate-200 font-bold">{s.deviceFingerprint}</span></div>
                    <div><span className="text-slate-500 block">Last Access</span><span className="text-slate-200 font-bold">{s.lastAccess}</span></div>
                    <div><span className="text-slate-500 block">Encrypted Tunnel</span><span className={s.encryptedTunnelActive ? 'text-cyan-400 font-bold' : 'text-red-400 font-bold'}>{s.encryptedTunnelActive ? 'Active' : 'Inactive'}</span></div>
                    <div><span className="text-slate-500 block">Enclave Attested</span><span className={s.enclaveAttested ? 'text-violet-400 font-bold' : 'text-slate-400 font-bold'}>{s.enclaveAttested ? 'Yes' : 'No'}</span></div>
                    <div><span className="text-slate-500 block">Policy Violations</span><span className={s.policyViolations > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{s.policyViolations}</span></div>
                  </div>
                  {s.riskIndicators.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Risk Indicators</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {s.riskIndicators.map((ri, i) => (
                          <span key={i} className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full border border-orange-500/20">{ri}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { addToast(`Session ${s.id} terminated`, 'warning'); setModalData(null); }} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl text-xs transition border border-red-500/30">Terminate Session</button>
                    <button onClick={() => { addToast(`Trust score elevated for ${s.userName}`, 'success'); setModalData(null); }} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-4 py-2 rounded-xl text-xs transition border border-emerald-500/30">Elevate Trust</button>
                    <button onClick={() => setModalData(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
                  </div>
                </>
              );
            })()}

            {/* Key Modal */}
            {modalType === 'key' && (() => {
              const k = modalData as EncryptionKey;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <KeyRound className="w-6 h-6 text-violet-400" />
                    <h3 className="text-xl font-bold text-white">{k.keyAlias}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(k.status)}`}>{k.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-xs font-mono">
                    <div><span className="text-slate-500 block">Algorithm</span><span className="text-slate-200 font-bold">{k.algorithm}</span></div>
                    <div><span className="text-slate-500 block">Key Size</span><span className="text-slate-200 font-bold">{k.keySize}-bit</span></div>
                    <div><span className="text-slate-500 block">Created</span><span className="text-slate-200 font-bold">{k.createdAt}</span></div>
                    <div><span className="text-slate-500 block">Expires</span><span className="text-slate-200 font-bold">{k.expiresAt}</span></div>
                    <div><span className="text-slate-500 block">Last Rotated</span><span className="text-slate-200 font-bold">{k.lastRotated}</span></div>
                    <div><span className="text-slate-500 block">Rotation Policy</span><span className="text-slate-200 font-bold">{k.rotationPolicy}</span></div>
                    <div><span className="text-slate-500 block">Usage Count</span><span className="text-slate-200 font-bold">{k.usageCount.toLocaleString()}</span></div>
                    <div><span className="text-slate-500 block">PQ Resistant</span><span className={k.pqResistant ? 'text-violet-400 font-bold' : 'text-amber-400 font-bold'}>{k.pqResistant ? 'Yes (Lattice/Hash)' : 'No — Classical Only'}</span></div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { addToast(`Key ${k.keyAlias} rotated successfully`, 'success'); setModalData(null); }} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-4 py-2 rounded-xl text-xs transition border border-emerald-500/30">Rotate Key Now</button>
                    <button onClick={() => { addToast(`Key ${k.keyAlias} revoked`, 'error'); setModalData(null); }} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl text-xs transition border border-red-500/30">Revoke</button>
                    <button onClick={() => setModalData(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
                  </div>
                </>
              );
            })()}

            {/* Compliance Modal */}
            {modalType === 'compliance' && (() => {
              const c = modalData as ComplianceRule;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className={`w-6 h-6 ${c.status === 'PASS' ? 'text-emerald-400' : c.status === 'FAIL' ? 'text-red-400' : 'text-amber-400'}`} />
                    <h3 className="text-xl font-bold text-white">{c.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(c.status)}`}>{c.status}</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{c.description}</p>
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-xs font-mono">
                    <div><span className="text-slate-500 block">Framework</span><span className="text-slate-200 font-bold">{c.framework}</span></div>
                    <div><span className="text-slate-500 block">Rule ID</span><span className="text-slate-200 font-bold">{c.ruleId}</span></div>
                    <div><span className="text-slate-500 block">Risk Rating</span><span className={`font-bold ${c.riskRating === 'HIGH' ? 'text-red-400' : c.riskRating === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>{c.riskRating}</span></div>
                    <div><span className="text-slate-500 block">Last Scan</span><span className="text-slate-200 font-bold">{new Date(c.lastScan).toLocaleString()}</span></div>
                  </div>
                  {c.remediation !== 'N/A — compliant.' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span><strong>Remediation:</strong> {c.remediation}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { addToast(`Compliance rule ${c.ruleId} scan triggered`, 'info'); setModalData(null); }} className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-4 py-2 rounded-xl text-xs transition border border-cyan-500/30">Re-Scan Now</button>
                    <button onClick={() => setModalData(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition">Close</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
