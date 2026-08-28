import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  BadgeAlert,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  Droplets,
  Eye,
  FileCheck2,
  Filter,
  Gauge,
  HeartPulse,
  Pause,
  Play,
  Radio,
  RefreshCcw,
  Search,
  ShieldAlert,
  Siren,
  Stethoscope,
  UserRound,
  UsersRound,
  Waves,
  X,
  Zap,
} from 'lucide-react';

type TriageCategory = 'IMMEDIATE' | 'DELAYED' | 'MINOR' | 'EXPECTANT';
type ProtocolId = 'CODE_RED' | 'CODE_STEMI' | 'MASSIVE_TRANSFUSION' | 'SEPSIS_HOUR_ONE';
type Avpu = 'A' | 'V' | 'P' | 'U';

interface VitalSnapshot {
  timestamp: string;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  map: number;
  respiratoryRate: number;
  spo2: number;
  temperatureC: number;
  lactate: number;
  shockIndex: number;
}

interface EmergencyPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: string;
  location: string;
  presentingProblem: string;
  arrivalMode: string;
  triageCategory: TriageCategory;
  activeProtocol: ProtocolId | null;
  ambulatory: boolean;
  spontaneousBreathing: boolean;
  pulsePresent: boolean;
  followsCommands: boolean;
  mentalStatus: Avpu;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  respiratoryRate: number;
  spo2: number;
  temperatureC: number;
  lactate: number;
  capillaryRefillSeconds: number;
  baseDeficit: number;
  gcs: number;
  supplementalOxygen: boolean;
  estimatedBloodLossMl: number;
  unitsRbcLastFourHours: number;
  allergies: string[];
  trend: VitalSnapshot[];
}

interface ProtocolDefinition {
  id: ProtocolId;
  title: string;
  summary: string;
  accent: string;
  roles: string[];
  steps: string[];
}

interface ProtocolEvent {
  id: string;
  protocolId: ProtocolId;
  patientId: string;
  patientName: string;
  timestamp: string;
  actor: string;
  rationale: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'STABILIZED';
  completedSteps: number[];
  signature: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  subject: string;
  actor: string;
  signature: string;
}

const TRIAGE_META: Record<TriageCategory, { label: string; badge: string; ring: string }> = {
  IMMEDIATE: { label: 'Immediate / Red', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40', ring: '#f43f5e' },
  DELAYED: { label: 'Delayed / Yellow', badge: 'bg-amber-400/15 text-amber-200 border-amber-400/40', ring: '#fbbf24' },
  MINOR: { label: 'Minor / Green', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', ring: '#10b981' },
  EXPECTANT: { label: 'Expectant / Black', badge: 'bg-slate-700 text-slate-200 border-slate-500', ring: '#64748b' },
};

const PROTOCOLS: Record<ProtocolId, ProtocolDefinition> = {
  CODE_RED: {
    id: 'CODE_RED',
    title: 'Code Red Resuscitation',
    summary: 'Immediate multidisciplinary resuscitation response for physiologic collapse.',
    accent: 'rose',
    roles: ['Emergency physician', 'Resuscitation nurse', 'Respiratory therapist', 'Clinical pharmacist'],
    steps: [
      'Assign team leader and establish closed-loop communication',
      'Apply ECG, SpO₂, blood pressure and capnography monitoring',
      'Establish two large-bore IV lines or intraosseous access',
      'Obtain blood gas, glucose, lactate and type-and-screen',
      'Repeat structured primary survey and document response',
    ],
  },
  CODE_STEMI: {
    id: 'CODE_STEMI',
    title: 'Code STEMI / Cath Lab',
    summary: 'Time-critical clinician-confirmed coronary reperfusion pathway.',
    accent: 'cyan',
    roles: ['Emergency physician', 'Interventional cardiologist', 'Cath lab nurse', 'Cardiac bed manager'],
    steps: [
      'Clinician-interpret 12-lead ECG and record acquisition time',
      'Record symptom onset and first-medical-contact timestamp',
      'Review antiplatelet and anticoagulant contraindications',
      'Transmit ECG and notify catheterization laboratory',
      'Document reperfusion decision and any exception reason',
    ],
  },
  MASSIVE_TRANSFUSION: {
    id: 'MASSIVE_TRANSFUSION',
    title: 'Massive Transfusion Protocol',
    summary: 'Coordinated hemorrhage control, component therapy and laboratory reassessment.',
    accent: 'rose',
    roles: ['Trauma team leader', 'Transfusion medicine', 'Blood bank runner', 'Operating theatre coordinator'],
    steps: [
      'Notify blood bank with patient identifier and emergency authorization',
      'Apply active warming and blood-component fluid warmer',
      'Trend ionized calcium, fibrinogen, INR, platelets and blood gas',
      'Secure definitive surgical or interventional hemorrhage control',
      'Reassess after each cooler and communicate protocol termination',
    ],
  },
  SEPSIS_HOUR_ONE: {
    id: 'SEPSIS_HOUR_ONE',
    title: 'Sepsis Hour-One Escalation',
    summary: 'Organ-dysfunction evaluation and time-sensitive local sepsis pathway.',
    accent: 'amber',
    roles: ['Emergency physician', 'Sepsis response nurse', 'Clinical pharmacist', 'Critical-care outreach'],
    steps: [
      'Measure lactate and plan repeat measurement when elevated',
      'Obtain blood cultures when this does not meaningfully delay therapy',
      'Administer antimicrobials per suspected source and local guidance',
      'Give clinician-directed crystalloid with responsiveness checks',
      'Escalate vasopressor support to the selected MAP target',
    ],
  },
};

const initialTrend = (heartRate: number, systolicBp: number, diastolicBp: number, respiratoryRate: number, spo2: number, temperatureC: number, lactate: number): VitalSnapshot[] =>
  Array.from({ length: 20 }, (_, index) => {
    const phase = (index - 20) / 4;
    const systolic = Math.round(systolicBp + Math.sin(phase) * 3);
    const diastolic = Math.round(diastolicBp + Math.cos(phase) * 2);
    return {
      timestamp: new Date(Date.now() - (19 - index) * 15000).toISOString(),
      heartRate: Math.round(heartRate + Math.sin(phase * 1.3) * 4),
      systolicBp: systolic,
      diastolicBp: diastolic,
      map: Math.round((systolic + 2 * diastolic) / 3),
      respiratoryRate: Math.round(respiratoryRate + Math.cos(phase) * 2),
      spo2: Number((spo2 + Math.sin(phase * 0.8)).toFixed(1)),
      temperatureC: Number((temperatureC + Math.sin(phase * 0.2) * 0.1).toFixed(1)),
      lactate: Number((lactate + Math.cos(phase * 0.25) * 0.15).toFixed(1)),
      shockIndex: Number(((heartRate + Math.sin(phase) * 4) / systolic).toFixed(2)),
    };
  });

const createPatient = (patient: Omit<EmergencyPatient, 'trend'>): EmergencyPatient => ({
  ...patient,
  trend: initialTrend(
    patient.heartRate,
    patient.systolicBp,
    patient.diastolicBp,
    patient.respiratoryRate,
    patient.spo2,
    patient.temperatureC,
    patient.lactate,
  ),
});

const INITIAL_PATIENTS: EmergencyPatient[] = [
  createPatient({
    id: 'ED-24017', mrn: 'MRN-904-771', name: 'Maya Chen', ageYears: 34, sex: 'Female', location: 'Resus 01',
    presentingProblem: 'Blunt polytrauma with suspected pelvic hemorrhage', arrivalMode: 'Prehospital trauma team',
    triageCategory: 'IMMEDIATE', activeProtocol: 'MASSIVE_TRANSFUSION', ambulatory: false, spontaneousBreathing: true,
    pulsePresent: true, followsCommands: true, mentalStatus: 'A', heartRate: 132, systolicBp: 82, diastolicBp: 48,
    respiratoryRate: 32, spo2: 93, temperatureC: 35.4, lactate: 5.8, capillaryRefillSeconds: 4, baseDeficit: -8.1,
    gcs: 14, supplementalOxygen: true, estimatedBloodLossMl: 1800, unitsRbcLastFourHours: 2, allergies: ['Penicillin'],
  }),
  createPatient({
    id: 'ED-24021', mrn: 'MRN-601-225', name: 'Arjun Mehta', ageYears: 61, sex: 'Male', location: 'Resus 02',
    presentingProblem: 'Crushing substernal pain with anterior ST elevation', arrivalMode: 'Ambulance', triageCategory: 'IMMEDIATE',
    activeProtocol: 'CODE_STEMI', ambulatory: false, spontaneousBreathing: true, pulsePresent: true, followsCommands: true,
    mentalStatus: 'A', heartRate: 112, systolicBp: 96, diastolicBp: 61, respiratoryRate: 24, spo2: 95,
    temperatureC: 36.7, lactate: 2.7, capillaryRefillSeconds: 3, baseDeficit: -2.2, gcs: 15,
    supplementalOxygen: false, estimatedBloodLossMl: 0, unitsRbcLastFourHours: 0, allergies: [],
  }),
  createPatient({
    id: 'ED-24029', mrn: 'MRN-188-403', name: 'Noah Williams', ageYears: 7, sex: 'Male', location: 'Pediatric 03',
    presentingProblem: 'Smoke inhalation with partial-thickness upper-limb burns', arrivalMode: 'Family transport',
    triageCategory: 'MINOR', activeProtocol: null, ambulatory: true, spontaneousBreathing: true, pulsePresent: true,
    followsCommands: true, mentalStatus: 'A', heartRate: 118, systolicBp: 104, diastolicBp: 66, respiratoryRate: 28,
    spo2: 97, temperatureC: 37.1, lactate: 1.9, capillaryRefillSeconds: 2, baseDeficit: -1.1, gcs: 15,
    supplementalOxygen: true, estimatedBloodLossMl: 0, unitsRbcLastFourHours: 0, allergies: ['Latex'],
  }),
  createPatient({
    id: 'ED-24034', mrn: 'MRN-755-099', name: 'Fatima Rahman', ageYears: 72, sex: 'Female', location: 'High Acuity 05',
    presentingProblem: 'Probable pneumonia with sepsis-associated hypotension', arrivalMode: 'Ambulance',
    triageCategory: 'IMMEDIATE', activeProtocol: 'SEPSIS_HOUR_ONE', ambulatory: false, spontaneousBreathing: true,
    pulsePresent: true, followsCommands: false, mentalStatus: 'V', heartRate: 121, systolicBp: 88, diastolicBp: 50,
    respiratoryRate: 27, spo2: 90, temperatureC: 39.1, lactate: 4.4, capillaryRefillSeconds: 4, baseDeficit: -5.4,
    gcs: 13, supplementalOxygen: true, estimatedBloodLossMl: 0, unitsRbcLastFourHours: 0, allergies: ['Sulfonamides'],
  }),
];

const categoryFromStart = (patient: EmergencyPatient): { category: TriageCategory; rationale: string[] } => {
  if (patient.ambulatory) return { category: 'MINOR', rationale: ['Ambulatory at primary triage checkpoint'] };
  if (!patient.spontaneousBreathing) return { category: 'EXPECTANT', rationale: ['No spontaneous respirations; airway intervention status required'] };
  if (patient.ageYears < 8 && (patient.respiratoryRate < 15 || patient.respiratoryRate > 45)) {
    return { category: 'IMMEDIATE', rationale: ['JumpSTART respiratory rate outside 15–45/min'] };
  }
  if (patient.ageYears >= 8 && patient.respiratoryRate > 30) {
    return { category: 'IMMEDIATE', rationale: ['START respiratory rate above 30/min'] };
  }
  if (!patient.pulsePresent || patient.capillaryRefillSeconds > 2) {
    return { category: 'IMMEDIATE', rationale: ['Perfusion screen meets immediate criteria'] };
  }
  if (!patient.followsCommands || patient.mentalStatus === 'P' || patient.mentalStatus === 'U') {
    return { category: 'IMMEDIATE', rationale: ['Mental-status screen meets immediate criteria'] };
  }
  return { category: 'DELAYED', rationale: ['Respiration, perfusion and mental-status checks within delayed criteria'] };
};

const scoreNews2 = (patient: EmergencyPatient): { total: number; risk: string; parts: [string, number][] } => {
  const rr = patient.respiratoryRate <= 8 || patient.respiratoryRate >= 25 ? 3 : patient.respiratoryRate >= 21 ? 2 : patient.respiratoryRate <= 11 ? 1 : 0;
  const oxygen = patient.spo2 <= 91 ? 3 : patient.spo2 <= 93 ? 2 : patient.spo2 <= 95 ? 1 : 0;
  const sbp = patient.systolicBp <= 90 || patient.systolicBp >= 220 ? 3 : patient.systolicBp <= 100 ? 2 : patient.systolicBp <= 110 ? 1 : 0;
  const pulse = patient.heartRate <= 40 || patient.heartRate >= 131 ? 3 : patient.heartRate >= 111 ? 2 : patient.heartRate <= 50 || patient.heartRate >= 91 ? 1 : 0;
  const consciousness = patient.mentalStatus === 'A' ? 0 : 3;
  const temperature = patient.temperatureC <= 35 ? 3 : patient.temperatureC >= 39.1 ? 2 : patient.temperatureC <= 36 || patient.temperatureC >= 38.1 ? 1 : 0;
  const parts: [string, number][] = [
    ['Respiration', rr], ['SpO₂ scale 1', oxygen], ['Supplemental O₂', patient.supplementalOxygen ? 2 : 0],
    ['Systolic pressure', sbp], ['Pulse', pulse], ['Consciousness', consciousness], ['Temperature', temperature],
  ];
  const total = parts.reduce((sum, [, score]) => sum + score, 0);
  return { total, risk: total >= 7 ? 'High' : total >= 5 ? 'Medium' : parts.some(([, score]) => score === 3) ? 'Low + single 3' : 'Low', parts };
};

const calculateQsofa = (patient: EmergencyPatient) =>
  Number(patient.respiratoryRate >= 22) + Number(patient.systolicBp <= 100) + Number(patient.gcs < 15);

const stableHash = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `demo-integrity-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const Sparkline = ({ values, color, label }: { values: number[]; color: string; label: string }) => {
  const width = 260;
  const height = 62;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = Math.max(maximum - minimum, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * width},${height - ((value - minimum) / spread) * (height - 8) - 4}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-16 w-full overflow-visible">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="#334155" strokeDasharray="4 5" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={Number(points.split(' ').at(-1)?.split(',')[1] ?? height / 2)} r="3.5" fill={color} />
    </svg>
  );
};

const MetricCard = ({ icon: Icon, label, value, unit, state, detail }: { icon: React.ElementType; label: string; value: string | number; unit: string; state: 'critical' | 'warning' | 'normal'; detail: string }) => {
  const styles = state === 'critical' ? 'border-rose-500/50 bg-rose-500/10 text-rose-300' : state === 'warning' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-slate-800 bg-slate-900 text-cyan-300';
  return (
    <div className={`rounded-xl border p-3 ${styles}`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400"><span>{label}</span><Icon size={15} /></div>
      <div className="mt-2 flex items-baseline gap-1"><span className="text-2xl font-semibold tabular-nums">{value}</span><span className="text-xs text-slate-400">{unit}</span></div>
      <p className="mt-1 truncate text-[11px] text-slate-500" title={detail}>{detail}</p>
    </div>
  );
};

export default function EmergencyTriageCommandStationPage() {
  const [patients, setPatients] = useState<EmergencyPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState(INITIAL_PATIENTS[0].id);
  const [streaming, setStreaming] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TriageCategory>('ALL');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [protocolModal, setProtocolModal] = useState<ProtocolId | null>(null);
  const [activationReason, setActivationReason] = useState('');
  const [events, setEvents] = useState<ProtocolEvent[]>([
    { id: 'EVT-811', protocolId: 'MASSIVE_TRANSFUSION', patientId: 'ED-24017', patientName: 'Maya Chen', timestamp: new Date(Date.now() - 240000).toISOString(), actor: 'Dr. A. Vance', rationale: 'Persistent hypotension with suspected pelvic hemorrhage and shock index above threshold.', status: 'ACTIVE', completedSteps: [0, 1], signature: 'demo-integrity-a91e42c7' },
    { id: 'EVT-812', protocolId: 'CODE_STEMI', patientId: 'ED-24021', patientName: 'Arjun Mehta', timestamp: new Date(Date.now() - 420000).toISOString(), actor: 'Dr. K. Iyer', rationale: 'Clinician-confirmed anterior STEMI with ongoing ischemic symptoms.', status: 'ACKNOWLEDGED', completedSteps: [0, 1, 2], signature: 'demo-integrity-809fd172' },
  ]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([
    { id: 'AUD-4001', timestamp: new Date(Date.now() - 540000).toISOString(), action: 'TRIAGE_REASSESSMENT', subject: 'ED-24034', actor: 'RN J. Okafor', signature: '0x27d6…a901' },
    { id: 'AUD-4002', timestamp: new Date(Date.now() - 420000).toISOString(), action: 'PROTOCOL_ACKNOWLEDGED', subject: 'ED-24021', actor: 'Dr. K. Iyer', signature: '0xb824…112c' },
  ]);
  const tickRef = useRef(0);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) ?? patients[0];
  const latest = selectedPatient.trend.at(-1)!;
  const news2 = useMemo(() => scoreNews2(selectedPatient), [selectedPatient]);
  const qsofa = useMemo(() => calculateQsofa(selectedPatient), [selectedPatient]);
  const startResult = useMemo(() => categoryFromStart(selectedPatient), [selectedPatient]);
  const shockIndex = Number((latest.heartRate / latest.systolicBp).toFixed(2));

  const filteredPatients = useMemo(() => patients.filter((patient) => {
    const matchesQuery = `${patient.name} ${patient.mrn} ${patient.location}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (categoryFilter === 'ALL' || patient.triageCategory === categoryFilter);
  }), [patients, query, categoryFilter]);

  useEffect(() => {
    if (!streaming) return undefined;
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      setPatients((current) => current.map((patient, patientIndex) => {
        const wave = Math.sin((tickRef.current + patientIndex) / 3);
        const jitter = Math.cos((tickRef.current + patientIndex * 2) / 4);
        const heartRate = Math.max(30, Math.round(patient.heartRate + wave * 3));
        const systolicBp = Math.max(45, Math.round(patient.systolicBp + jitter * 2));
        const diastolicBp = Math.max(25, Math.round(patient.diastolicBp + wave));
        const snapshot: VitalSnapshot = {
          timestamp: new Date().toISOString(), heartRate, systolicBp, diastolicBp,
          map: Math.round((systolicBp + 2 * diastolicBp) / 3),
          respiratoryRate: Math.max(4, Math.round(patient.respiratoryRate + jitter)),
          spo2: Number(Math.min(100, Math.max(70, patient.spo2 + wave * 0.3)).toFixed(1)),
          temperatureC: Number((patient.temperatureC + jitter * 0.03).toFixed(1)),
          lactate: Number(Math.max(0.4, patient.lactate + wave * 0.04).toFixed(1)),
          shockIndex: Number((heartRate / systolicBp).toFixed(2)),
        };
        return { ...patient, heartRate, systolicBp, diastolicBp, trend: [...patient.trend.slice(-29), snapshot] };
      }));
    }, Math.max(500, 2400 / speed));
    return () => window.clearInterval(interval);
  }, [streaming, speed]);

  const activateProtocol = useCallback(() => {
    if (!protocolModal || activationReason.trim().length < 10) return;
    const timestamp = new Date().toISOString();
    const id = `EVT-${Date.now().toString().slice(-6)}`;
    const signature = stableHash(`${id}|${selectedPatient.id}|${protocolModal}|${timestamp}|${activationReason}`);
    setEvents((current) => [{ id, protocolId: protocolModal, patientId: selectedPatient.id, patientName: selectedPatient.name, timestamp, actor: 'Clinical Commander', rationale: activationReason.trim(), status: 'ACTIVE', completedSteps: [], signature }, ...current]);
    setPatients((current) => current.map((patient) => patient.id === selectedPatient.id ? { ...patient, activeProtocol: protocolModal } : patient));
    setAuditEvents((current) => [{ id: `AUD-${Date.now().toString().slice(-6)}`, timestamp, action: `ACTIVATE_${protocolModal}`, subject: selectedPatient.id, actor: 'Clinical Commander', signature }, ...current]);
    setProtocolModal(null);
    setActivationReason('');
  }, [activationReason, protocolModal, selectedPatient]);

  const toggleChecklist = (eventId: string, stepIndex: number) => {
    setEvents((current) => current.map((event) => {
      if (event.id !== eventId) return event;
      const completedSteps = event.completedSteps.includes(stepIndex) ? event.completedSteps.filter((item) => item !== stepIndex) : [...event.completedSteps, stepIndex];
      return { ...event, completedSteps, status: completedSteps.length === PROTOCOLS[event.protocolId].steps.length ? 'STABILIZED' : 'ACKNOWLEDGED' };
    }));
  };

  const exportFhir = () => {
    const bundle = {
      resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(),
      entry: [
        { resource: { resourceType: 'Patient', id: selectedPatient.id, identifier: [{ system: 'urn:medtrack:mrn', value: selectedPatient.mrn }], name: [{ text: selectedPatient.name }] } },
        { resource: { resourceType: 'RiskAssessment', id: `triage-${selectedPatient.id}`, status: 'final', subject: { reference: `Patient/${selectedPatient.id}` }, occurrenceDateTime: new Date().toISOString(), method: { text: selectedPatient.ageYears < 8 ? 'JumpSTART triage' : 'START triage' }, prediction: [{ outcome: { text: TRIAGE_META[startResult.category].label }, rationale: startResult.rationale }], note: [{ text: 'Clinical decision support only; requires clinician confirmation and reassessment.' }] } },
      ],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedPatient.id}-triage-fhir-r4.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur lg:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-rose-400"><Siren size={25} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /></div>
            <div><div className="flex items-center gap-2"><h1 className="text-lg font-semibold tracking-tight">Emergency Triage Command Station</h1><span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-300">Enterprise</span></div><p className="text-xs text-slate-500">START · JumpSTART · NEWS2 · qSOFA · HL7 FHIR R4 · controlled protocol activation</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-1">
              <button type="button" onClick={() => setStreaming((value) => !value)} className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium ${streaming ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-300 hover:bg-slate-800'}`}>{streaming ? <Pause size={14} /> : <Play size={14} />}{streaming ? 'Pause stream' : 'Resume stream'}</button>
              {[1, 2, 4].map((value) => <button type="button" key={value} onClick={() => setSpeed(value)} className={`rounded px-2 py-1.5 text-xs ${speed === value ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-200'}`}>{value}×</button>)}
            </div>
            <button type="button" onClick={exportFhir} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-cyan-500/50"><Download size={14} />FHIR R4</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:p-6">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 lg:sticky lg:top-4 lg:h-[calc(100vh-3rem)]">
          <div className="flex items-center justify-between px-1 pb-3"><div><p className="text-sm font-semibold">Live census</p><p className="text-xs text-slate-500">{patients.length} tracked · {patients.filter((item) => item.triageCategory === 'IMMEDIATE').length} immediate</p></div><Radio size={17} className={streaming ? 'text-cyan-400' : 'text-slate-600'} /></div>
          <label className="relative block"><Search className="absolute left-3 top-2.5 text-slate-500" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or bed" className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs outline-none placeholder:text-slate-600 focus:border-cyan-500/60" /></label>
          <div className="relative mt-2"><Filter className="pointer-events-none absolute left-3 top-2.5 text-slate-500" size={14} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'ALL' | TriageCategory)} className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-8 text-xs outline-none focus:border-cyan-500/60"><option value="ALL">All triage categories</option>{Object.entries(TRIAGE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-slate-500" size={14} /></div>
          <div className="mt-3 space-y-2 overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
            {filteredPatients.map((patient) => {
              const current = patient.trend.at(-1)!;
              return <button type="button" key={patient.id} onClick={() => setSelectedPatientId(patient.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedPatient.id === patient.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'}`}>
                <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium text-slate-100">{patient.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{patient.location} · {patient.mrn}</p></div><span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${TRIAGE_META[patient.triageCategory].badge}`}>{patient.triageCategory}</span></div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">{patient.presentingProblem}</p>
                <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]"><span className="rounded bg-slate-900 px-1 py-1 text-slate-400">HR <b className="text-slate-200">{current.heartRate}</b></span><span className="rounded bg-slate-900 px-1 py-1 text-slate-400">SBP <b className="text-slate-200">{current.systolicBp}</b></span><span className="rounded bg-slate-900 px-1 py-1 text-slate-400">SpO₂ <b className="text-slate-200">{current.spo2}</b></span></div>
              </button>;
            })}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-3"><div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-cyan-300"><UserRound size={22} /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{selectedPatient.name}</h2><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${TRIAGE_META[selectedPatient.triageCategory].badge}`}>{TRIAGE_META[selectedPatient.triageCategory].label}</span>{selectedPatient.activeProtocol && <span className="flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-300"><BadgeAlert size={12} />{PROTOCOLS[selectedPatient.activeProtocol].title}</span>}</div><p className="mt-1 text-sm text-slate-300">{selectedPatient.presentingProblem}</p><p className="mt-1 text-xs text-slate-500">{selectedPatient.ageYears}y · {selectedPatient.sex} · {selectedPatient.mrn} · {selectedPatient.location} · {selectedPatient.arrivalMode}</p></div></div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setInspectorOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs hover:border-cyan-500/50"><Eye size={14} />Clinical inspector</button><button type="button" onClick={() => { setPatients(INITIAL_PATIENTS); tickRef.current = 0; }} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs hover:border-cyan-500/50"><RefreshCcw size={14} />Reset scenario</button></div>
            </div>
            {selectedPatient.allergies.length > 0 && <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"><AlertTriangle size={15} /><b>Allergies:</b> {selectedPatient.allergies.join(', ')}</div>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={HeartPulse} label="Heart rate" value={latest.heartRate} unit="bpm" state={latest.heartRate >= 130 ? 'critical' : latest.heartRate >= 110 ? 'warning' : 'normal'} detail="Continuous monitor feed" />
            <MetricCard icon={Gauge} label="Arterial pressure" value={`${latest.systolicBp}/${latest.diastolicBp}`} unit="mmHg" state={latest.systolicBp <= 90 ? 'critical' : latest.systolicBp <= 100 ? 'warning' : 'normal'} detail={`Calculated MAP ${latest.map} mmHg`} />
            <MetricCard icon={Waves} label="Respiration" value={latest.respiratoryRate} unit="/min" state={latest.respiratoryRate > 30 ? 'critical' : latest.respiratoryRate >= 22 ? 'warning' : 'normal'} detail={`SpO₂ ${latest.spo2}%${selectedPatient.supplementalOxygen ? ' on oxygen' : ' on room air'}`} />
            <MetricCard icon={Droplets} label="Shock index" value={shockIndex} unit="HR/SBP" state={shockIndex >= 1.4 ? 'critical' : shockIndex >= 0.9 ? 'warning' : 'normal'} detail={`Lactate ${latest.lactate} mmol/L`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><Activity size={16} className="text-cyan-400" />Streaming physiology</h3><p className="mt-1 text-xs text-slate-500">Synthetic demonstration feed · {latest.timestamp.slice(11, 19)} UTC</p></div><span className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] ${streaming ? 'bg-cyan-500/10 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${streaming ? 'animate-pulse bg-cyan-400' : 'bg-slate-500'}`} />{streaming ? 'LIVE' : 'PAUSED'}</span></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex justify-between text-xs"><span className="text-slate-400">Heart rate trend</span><b className="text-rose-300">{latest.heartRate} bpm</b></div><Sparkline values={selectedPatient.trend.map((item) => item.heartRate)} color="#fb7185" label="Heart rate trend" /></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex justify-between text-xs"><span className="text-slate-400">Systolic pressure</span><b className="text-cyan-300">{latest.systolicBp} mmHg</b></div><Sparkline values={selectedPatient.trend.map((item) => item.systolicBp)} color="#22d3ee" label="Systolic blood pressure trend" /></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex justify-between text-xs"><span className="text-slate-400">Oxygen saturation</span><b className="text-sky-300">{latest.spo2}%</b></div><Sparkline values={selectedPatient.trend.map((item) => item.spo2)} color="#38bdf8" label="Oxygen saturation trend" /></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex justify-between text-xs"><span className="text-slate-400">Shock index</span><b className="text-amber-200">{shockIndex}</b></div><Sparkline values={selectedPatient.trend.map((item) => item.shockIndex)} color="#fbbf24" label="Shock index trend" /></div></div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck size={16} className="text-amber-300" />Decision-support scores</h3><div className="mt-4 space-y-3"><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">{selectedPatient.ageYears < 8 ? 'JumpSTART' : 'START'} primary triage</span><span className={`rounded border px-2 py-1 text-[10px] font-semibold ${TRIAGE_META[startResult.category].badge}`}>{startResult.category}</span></div><p className="mt-2 text-xs text-slate-300">{startResult.rationale[0]}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">NEWS2 Scale 1</span><span className={`text-xl font-semibold ${news2.total >= 7 ? 'text-rose-300' : news2.total >= 5 ? 'text-amber-200' : 'text-cyan-300'}`}>{news2.total}</span></div><p className="mt-1 text-xs text-slate-500">{news2.risk} response tier</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex items-center justify-between"><span className="text-xs text-slate-400">qSOFA prompt</span><span className={`text-xl font-semibold ${qsofa >= 2 ? 'text-rose-300' : 'text-cyan-300'}`}>{qsofa}/3</span></div><p className="mt-1 text-xs text-slate-500">Risk prompt only; does not diagnose or exclude sepsis.</p></div></div></div>
          </div>

          <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-slate-900/70 to-slate-900/70 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert size={17} className="text-rose-400" />Emergency protocol control</h3><p className="mt-1 text-xs text-slate-400">Activation requires a patient-specific rationale and creates a signed audit event.</p></div><div className="flex flex-wrap gap-2">{(Object.keys(PROTOCOLS) as ProtocolId[]).map((id) => <button type="button" key={id} onClick={() => { setProtocolModal(id); setActivationReason(`${PROTOCOLS[id].title} requested for ${selectedPatient.name}: `); }} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${id === 'CODE_RED' || id === 'MASSIVE_TRANSFUSION' ? 'border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : id === 'CODE_STEMI' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20' : 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'}`}><Zap size={13} />{PROTOCOLS[id].title}</button>)}</div></div></div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound size={16} className="text-cyan-300" />Active response board</h3><span className="text-xs text-slate-500">{events.filter((item) => item.status !== 'STABILIZED').length} active</span></div><div className="mt-4 space-y-3">{events.slice(0, 4).map((event) => { const definition = PROTOCOLS[event.protocolId]; return <article key={event.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{definition.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{event.patientName} · {new Date(event.timestamp).toLocaleTimeString()}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${event.status === 'ACTIVE' ? 'bg-rose-500/15 text-rose-300' : event.status === 'STABILIZED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>{event.status}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{event.rationale}</p><div className="mt-3 flex flex-wrap gap-1.5">{definition.steps.map((step, index) => <button type="button" key={step} onClick={() => toggleChecklist(event.id, index)} title={step} className={`flex h-6 w-6 items-center justify-center rounded border ${event.completedSteps.includes(index) ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 text-slate-600 hover:border-slate-500'}`}>{event.completedSteps.includes(index) ? <Check size={12} /> : index + 1}</button>)}</div><p className="mt-2 truncate font-mono text-[9px] text-slate-600">{event.signature}</p></article>; })}</div></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 size={16} className="text-emerald-300" />21 CFR Part 11 audit view</h3><span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] uppercase tracking-widest text-emerald-300">Append-only</span></div><div className="mt-4 overflow-hidden rounded-xl border border-slate-800"><table className="w-full text-left text-xs"><thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Seal</th></tr></thead><tbody className="divide-y divide-slate-800">{auditEvents.slice(0, 6).map((event) => <tr key={event.id} className="bg-slate-900/40"><td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</td><td className="px-3 py-2"><p className="font-medium text-slate-300">{event.action}</p><p className="text-[10px] text-slate-600">{event.subject}</p></td><td className="px-3 py-2 text-slate-400">{event.actor}</td><td className="max-w-24 truncate px-3 py-2 font-mono text-[9px] text-emerald-400">{event.signature}</td></tr>)}</tbody></table></div><p className="mt-3 text-[11px] leading-4 text-slate-500">Demo signatures visualize audit controls. Production signing must use managed keys, authenticated identities, immutable retention and validated system procedures.</p></div>
          </div>

          <footer className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-[11px] text-slate-500 md:flex-row md:items-center md:justify-between"><p className="flex items-center gap-2"><Stethoscope size={14} />Clinical decision support only. Confirm classifications, scores and activations using bedside assessment and local policy.</p><p className="flex items-center gap-2"><Clock3 size={13} />Last telemetry tick {new Date(latest.timestamp).toLocaleTimeString()}</p></footer>
        </section>
      </div>

      {inspectorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="inspector-title"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 p-4 backdrop-blur"><div><h2 id="inspector-title" className="font-semibold">Clinical score inspector</h2><p className="text-xs text-slate-500">{selectedPatient.name} · transparent rule trace</p></div><button type="button" onClick={() => setInspectorOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close inspector"><X size={18} /></button></div><div className="grid gap-4 p-4 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><h3 className="text-sm font-semibold">{selectedPatient.ageYears < 8 ? 'JumpSTART' : 'START'} trace</h3><div className="mt-3 space-y-2 text-xs text-slate-400">{[['Ambulatory', selectedPatient.ambulatory ? 'Yes' : 'No'], ['Spontaneous breathing', selectedPatient.spontaneousBreathing ? 'Yes' : 'No'], ['Respiratory rate', `${latest.respiratoryRate}/min`], ['Pulse present', selectedPatient.pulsePresent ? 'Yes' : 'No'], ['Capillary refill', `${selectedPatient.capillaryRefillSeconds}s`], ['Follows commands', selectedPatient.followsCommands ? 'Yes' : 'No'], ['Result', TRIAGE_META[startResult.category].label]].map(([label, value]) => <div key={label} className="flex justify-between border-b border-slate-800 pb-2"><span>{label}</span><b className="text-slate-200">{value}</b></div>)}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">NEWS2 Scale 1 trace</h3><b className="text-xl text-amber-200">{news2.total}</b></div><div className="mt-3 space-y-2">{news2.parts.map(([label, score]) => <div key={label} className="flex items-center justify-between text-xs"><span className="text-slate-400">{label}</span><span className={`flex h-6 w-6 items-center justify-center rounded ${score === 3 ? 'bg-rose-500/20 text-rose-300' : score > 0 ? 'bg-amber-400/20 text-amber-200' : 'bg-slate-800 text-slate-400'}`}>{score}</span></div>)}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><h3 className="text-sm font-semibold">Perfusion & hemorrhage</h3><div className="mt-3 space-y-2 text-xs text-slate-400">{[['Shock index', shockIndex], ['Modified shock index', (latest.heartRate / latest.map).toFixed(2)], ['Lactate', `${latest.lactate} mmol/L`], ['Base deficit', selectedPatient.baseDeficit], ['Estimated blood loss', `${selectedPatient.estimatedBloodLossMl} mL`], ['RBC units / 4 h', selectedPatient.unitsRbcLastFourHours]].map(([label, value]) => <div key={label} className="flex justify-between"><span>{label}</span><b className="text-slate-200">{value}</b></div>)}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><h3 className="text-sm font-semibold">Clinical guardrails</h3><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400"><li>• START and JumpSTART are primary mass-casualty triage tools requiring reassessment.</li><li>• NEWS2 uses Scale 1 here; use Scale 2 only under a documented clinical pathway.</li><li>• qSOFA is a risk prompt and must not be used to rule out sepsis.</li><li>• Protocol recommendations require explicit clinician confirmation.</li></ul></div></div></div></div>}

      {protocolModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="protocol-title"><div className="w-full max-w-xl rounded-2xl border border-rose-500/40 bg-slate-900 shadow-2xl shadow-rose-950/30"><div className="flex items-start justify-between border-b border-slate-800 p-4"><div className="flex gap-3"><div className="rounded-xl bg-rose-500/15 p-2.5 text-rose-300"><Ambulance size={22} /></div><div><h2 id="protocol-title" className="font-semibold">Activate {PROTOCOLS[protocolModal].title}</h2><p className="mt-1 text-xs text-slate-500">For {selectedPatient.name} · {selectedPatient.mrn}</p></div></div><button type="button" onClick={() => setProtocolModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Cancel activation"><X size={18} /></button></div><div className="p-4"><div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100"><b>Clinician confirmation required.</b> This action notifies response roles and creates an auditable protocol event. Verify the patient, trigger criteria, and local policy before activation.</div><p className="mt-4 text-sm text-slate-300">{PROTOCOLS[protocolModal].summary}</p><div className="mt-4"><label htmlFor="activation-reason" className="text-xs font-medium text-slate-300">Patient-specific clinical rationale</label><textarea id="activation-reason" value={activationReason} onChange={(event) => setActivationReason(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-rose-500/60" placeholder="Document observed criteria and reason for activation…" /></div><div className="mt-4"><p className="text-xs font-medium text-slate-300">Response roles</p><div className="mt-2 flex flex-wrap gap-2">{PROTOCOLS[protocolModal].roles.map((role) => <span key={role} className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-slate-400">{role}</span>)}</div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setProtocolModal(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800">Cancel</button><button type="button" disabled={activationReason.trim().length < 10} onClick={activateProtocol} className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"><Siren size={14} />Confirm activation</button></div></div></div></div>}
    </main>
  );
}
