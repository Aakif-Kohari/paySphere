import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Activity,
  Heart,
  Wind,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Filter,
  Search,
  Sliders,
  Settings,
  ChevronRight,
  ChevronDown,
  Info,
  Layers,
  Zap,
  Gauge,
  Droplets,
  Syringe,
  FileText,
  Clock,
  UserCheck,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Maximize2,
  Volume2,
  VolumeX,
  Stethoscope,
  Cpu,
  Workflow,
  Sparkles,
  LifeBuoy,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
 * TypeScript Interfaces & Constants
 * ───────────────────────────────────────────────────────────── */

export type ECMOMode = 'VV_ECMO' | 'VA_ECMO' | 'VAV_ECMO';

export interface ECMOPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  weightKg: number;
  heightCm: number;
  gender: string;
  diagnosis: string;
  ecmoMode: ECMOMode;
  cannulaDrainage: string;
  cannulaReinfusion: string;
  cannulationDate: string;
  daysOnECMO: number;
  pumpRPM: number;
  bloodFlowLPM: number;
  sweepGasFlowLPM: number;
  sweepFiO2: number;
  p1PrePump: number;
  p2PreOxy: number;
  p3PostOxy: number;
  transmembraneDeltaP: number;
  arterialPaO2: number;
  arterialPaCO2: number;
  postOxyPaO2: number;
  postOxyPaCO2: number;
  svO2Percent: number;
  anticoagulant: 'UFH' | 'BIVALIRUDIN' | 'ARGATROBAN';
  infusionRate: string;
  actSeconds: number;
  antiXa: number;
  platelets: number;
  fibrinogenMgDl: number;
  plasmaFreeHbMgDl: number;
  ventMode: string;
  ventPplat: number;
  ventPEEP: number;
  ventDrivingPressure: number;
  ventRR: number;
  ventVtMl: number;
  ventFiO2: number;
  mechanicalPower: number;
  murrayScore: number;
  clinicalStatus: string;
}

export interface TelemetryDataPoint {
  timestamp: string;
  tick: number;
  p1: number;
  p2: number;
  p3: number;
  deltaP: number;
  flow: number;
  rpm: number;
  svO2: number;
  drivingP: number;
  mechPower: number;
}

export interface ClinicalAlarm {
  id: string;
  timestamp: string;
  code: string;
  severity: 'CRITICAL' | 'HIGH_RISK' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  action: string;
  acknowledged: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operator: string;
  category: 'CIRCUIT' | 'VENTILATOR' | 'ANTICOAGULATION' | 'EMERGENCY_PROTOCOL' | 'SYSTEM';
  action: string;
  deltaSummary: string;
  sha256Signature: string;
}

/* ─────────────────────────────────────────────────────────────
 * Initial Patient Registry Fixtures
 * ───────────────────────────────────────────────────────────── */

const PATIENT_FIXTURES: ECMOPatient[] = [
  {
    id: 'PT-ECMO-8801',
    name: 'Elena Rostova, MD',
    mrn: 'MRN-7749201',
    age: 38,
    weightKg: 68,
    heightCm: 168,
    gender: 'Female',
    diagnosis: 'Severe Viral ARDS with Cytokine Storm & Barotrauma',
    ecmoMode: 'VV_ECMO',
    cannulaDrainage: '25 Fr Multi-Stage Femoral Venous (Right)',
    cannulaReinfusion: '19 Fr Bio-Flex Internal Jugular Venous (Right)',
    cannulationDate: '2026-08-18T04:30:00Z',
    daysOnECMO: 3.8,
    pumpRPM: 3850,
    bloodFlowLPM: 4.8,
    sweepGasFlowLPM: 5.5,
    sweepFiO2: 1.0,
    p1PrePump: -42,
    p2PreOxy: 185,
    p3PostOxy: 156,
    transmembraneDeltaP: 29,
    arterialPaO2: 88,
    arterialPaCO2: 41,
    postOxyPaO2: 445,
    postOxyPaCO2: 32,
    svO2Percent: 76.5,
    anticoagulant: 'UFH',
    infusionRate: '18.5 units/kg/hr',
    actSeconds: 198,
    antiXa: 0.38,
    platelets: 142000,
    fibrinogenMgDl: 285,
    plasmaFreeHbMgDl: 12,
    ventMode: 'PC-BIPAP (Resting Lung)',
    ventPplat: 22,
    ventPEEP: 12,
    ventDrivingPressure: 10,
    ventRR: 8,
    ventVtMl: 220,
    ventFiO2: 0.35,
    mechanicalPower: 7.8,
    murrayScore: 3.2,
    clinicalStatus: 'STABLE_ECMO_LUNG_REST',
  },
  {
    id: 'PT-ECMO-8802',
    name: 'Marcus Vance',
    mrn: 'MRN-9031842',
    age: 54,
    weightKg: 84,
    heightCm: 178,
    gender: 'Male',
    diagnosis: 'Post-Anterior STEMI Cardiogenic Shock & E-CPR Rescue',
    ecmoMode: 'VA_ECMO',
    cannulaDrainage: '23 Fr Femoral Venous (Left)',
    cannulaReinfusion: '17 Fr Femoral Arterial + 7 Fr Distal Perfusion (Right)',
    cannulationDate: '2026-08-20T11:15:00Z',
    daysOnECMO: 1.5,
    pumpRPM: 4200,
    bloodFlowLPM: 5.2,
    sweepGasFlowLPM: 4.2,
    sweepFiO2: 0.9,
    p1PrePump: -65,
    p2PreOxy: 240,
    p3PostOxy: 198,
    transmembraneDeltaP: 42,
    arterialPaO2: 120,
    arterialPaCO2: 39,
    postOxyPaO2: 480,
    postOxyPaCO2: 34,
    svO2Percent: 72.0,
    anticoagulant: 'BIVALIRUDIN',
    infusionRate: '0.12 mg/kg/hr',
    actSeconds: 215,
    antiXa: 0.0,
    platelets: 118000,
    fibrinogenMgDl: 210,
    plasmaFreeHbMgDl: 18,
    ventMode: 'VC-CMV (Protective)',
    ventPplat: 24,
    ventPEEP: 10,
    ventDrivingPressure: 14,
    ventRR: 12,
    ventVtMl: 380,
    ventFiO2: 0.40,
    mechanicalPower: 12.4,
    murrayScore: 2.5,
    clinicalStatus: 'CARDIOGENIC_RECOVERY_PHASE',
  },
  {
    id: 'PT-ECMO-8803',
    name: 'Sophia Chen-Kowalski',
    mrn: 'MRN-5510294',
    age: 29,
    weightKg: 58,
    heightCm: 162,
    gender: 'Female',
    diagnosis: 'Amniotic Fluid Embolism with Catastrophic ARDS & DIC',
    ecmoMode: 'VV_ECMO',
    cannulaDrainage: '27 Fr Dual-Lumen Bicaval Avalon (RIJ)',
    cannulaReinfusion: 'Dual-Lumen PA Reinfusion Port',
    cannulationDate: '2026-08-21T01:40:00Z',
    daysOnECMO: 0.9,
    pumpRPM: 4500,
    bloodFlowLPM: 5.6,
    sweepGasFlowLPM: 7.0,
    sweepFiO2: 1.0,
    p1PrePump: -88,
    p2PreOxy: 295,
    p3PostOxy: 232,
    transmembraneDeltaP: 63,
    arterialPaO2: 64,
    arterialPaCO2: 56,
    postOxyPaO2: 310,
    postOxyPaCO2: 44,
    svO2Percent: 63.8,
    anticoagulant: 'ARGATROBAN',
    infusionRate: '1.2 mcg/kg/min',
    actSeconds: 174,
    antiXa: 0.0,
    platelets: 68000,
    fibrinogenMgDl: 135,
    plasmaFreeHbMgDl: 34,
    ventMode: 'APRV / BiLevel Rescue',
    ventPplat: 28,
    ventPEEP: 14,
    ventDrivingPressure: 14,
    ventRR: 14,
    ventVtMl: 260,
    ventFiO2: 0.60,
    mechanicalPower: 16.2,
    murrayScore: 3.8,
    clinicalStatus: 'HIGH_DELTA_P_MEMBRANE_ALERT',
  },
];

/* ─────────────────────────────────────────────────────────────
 * Main Component Definition
 * ───────────────────────────────────────────────────────────── */

export default function ECMOVentilationTelemetryPage() {
  const [patients, setPatients] = useState<ECMOPatient[]>(PATIENT_FIXTURES);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(PATIENT_FIXTURES[0].id);
  const [activeTab, setActiveTab] = useState<'circuit' | 'ventilation' | 'anticoag' | 'emergency' | 'audit'>('circuit');

  // Simulation Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [tickCounter, setTickCounter] = useState<number>(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // History and Alerts
  const [telemetryHistory, setTelemetryHistory] = useState<Record<string, TelemetryDataPoint[]>>({});
  const [activeAlarms, setActiveAlarms] = useState<ClinicalAlarm[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Modals and Inspectors
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);
  const [selectedEmergencyProtocol, setSelectedEmergencyProtocol] = useState<string | null>(null);
  const [completedChecklistSteps, setCompletedChecklistSteps] = useState<Record<string, boolean>>({});

  // Sweep Gas & Flow Override Sandbox Controls
  const [overrideRPM, setOverrideRPM] = useState<number>(3850);
  const [overrideSweepFlow, setOverrideSweepFlow] = useState<number>(5.5);
  const [overrideSweepFiO2, setOverrideSweepFiO2] = useState<number>(1.0);
  const [overrideVentPEEP, setOverrideVentPEEP] = useState<number>(12);
  const [overrideVentPplat, setOverrideVentPplat] = useState<number>(22);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  // Synchronize overrides when switching patient
  useEffect(() => {
    if (selectedPatient) {
      setOverrideRPM(selectedPatient.pumpRPM);
      setOverrideSweepFlow(selectedPatient.sweepGasFlowLPM);
      setOverrideSweepFiO2(selectedPatient.sweepFiO2);
      setOverrideVentPEEP(selectedPatient.ventPEEP);
      setOverrideVentPplat(selectedPatient.ventPplat);
    }
  }, [selectedPatientId]);

  /* ─────────────────────────────────────────────────────────────
   * Real-Time Telemetry Simulation Engine
   * ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = Math.max(250, 1000 / simSpeed);
    const timer = setInterval(() => {
      setTickCounter((prev) => prev + 1);

      setPatients((prevList) =>
        prevList.map((pt) => {
          const jitter = (n: number) => (Math.random() - 0.5) * n;

          const p1 = Math.min(-15, Math.max(-180, pt.p1PrePump + jitter(2.0)));
          const p2 = Math.min(380, Math.max(100, pt.p2PreOxy + jitter(3.0)));
          const p3 = Math.min(320, Math.max(80, pt.p3PostOxy + jitter(2.5)));
          const deltaP = Number((p2 - p3).toFixed(1));
          const flow = Number(Math.max(1.0, pt.bloodFlowLPM + jitter(0.06)).toFixed(2));
          const rpm = Math.round(pt.pumpRPM + jitter(12));
          const svO2 = Number(Math.min(99, Math.max(40, pt.svO2Percent + jitter(0.3))).toFixed(1));
          const drivingP = Number((pt.ventPplat - pt.ventPEEP + jitter(0.15)).toFixed(1));
          const mechPower = Number(
            (0.098 * pt.ventRR * (pt.ventVtMl / 1000) * (pt.ventPplat - drivingP / 2) + jitter(0.1)).toFixed(2)
          );

          // Update patient object
          const updatedPt: ECMOPatient = {
            ...pt,
            pumpRPM: rpm,
            bloodFlowLPM: flow,
            p1PrePump: Number(p1.toFixed(1)),
            p2PreOxy: Number(p2.toFixed(1)),
            p3PostOxy: Number(p3.toFixed(1)),
            transmembraneDeltaP: deltaP,
            svO2Percent: svO2,
            ventDrivingPressure: drivingP,
            mechanicalPower: mechPower,
          };

          return updatedPt;
        })
      );
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, simSpeed]);

  // Record Telemetry History & Alarm Monitor
  useEffect(() => {
    if (!selectedPatient) return;

    const newPoint: TelemetryDataPoint = {
      timestamp: new Date().toLocaleTimeString(),
      tick: tickCounter,
      p1: selectedPatient.p1PrePump,
      p2: selectedPatient.p2PreOxy,
      p3: selectedPatient.p3PostOxy,
      deltaP: selectedPatient.transmembraneDeltaP,
      flow: selectedPatient.bloodFlowLPM,
      rpm: selectedPatient.pumpRPM,
      svO2: selectedPatient.svO2Percent,
      drivingP: selectedPatient.ventDrivingPressure,
      mechPower: selectedPatient.mechanicalPower,
    };

    setTelemetryHistory((prev) => {
      const patientHist = prev[selectedPatient.id] || [];
      const updated = [...patientHist.slice(-25), newPoint];
      return { ...prev, [selectedPatient.id]: updated };
    });

    // Check Safety Interlocks & Alarms
    const newAlarms: ClinicalAlarm[] = [];

    if (selectedPatient.transmembraneDeltaP >= 55) {
      newAlarms.push({
        id: `ALM-DELTAP-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        code: 'DELTA_P_CRITICAL',
        severity: 'CRITICAL',
        title: 'Oxygenator Transmembrane Pressure Spike (Delta P > 55 mmHg)',
        message: `High risk of oxygenator thrombosis. Membrane resistance elevated at ${(
          (selectedPatient.transmembraneDeltaP / selectedPatient.bloodFlowLPM) *
          13.33
        ).toFixed(1)} Wood units.`,
        action: 'Prepare backup circuit console, notify perfusionist, titrate anticoagulation.',
        acknowledged: false,
      });
    }

    if (selectedPatient.p1PrePump <= -100) {
      newAlarms.push({
        id: `ALM-P1-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        code: 'DRAINAGE_COLLAPSE',
        severity: 'CRITICAL',
        title: 'Severe Negative Drainage Pressure (P1 < -100 mmHg)',
        message: 'Risk of line cavitation, chattering, and venous hemolysis.',
        action: 'Reduce RPM slightly, assess intravascular volume, check cannula position.',
        acknowledged: false,
      });
    }

    if (selectedPatient.ventDrivingPressure > 14) {
      newAlarms.push({
        id: `ALM-DRIVEP-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        code: 'VENT_BAROTRAUMA',
        severity: 'WARNING',
        title: 'Ventilator Driving Pressure > 14 cmH2O',
        message: 'Lungs exceed ultra-protective resting parameters. Risk of VILI.',
        action: 'Lower tidal volume / inspiratory pressure; rely on sweep gas for PaCO2 clearance.',
        acknowledged: false,
      });
    }

    if (newAlarms.length > 0) {
      setActiveAlarms((prev) => {
        const existingCodes = new Set(prev.map((a) => a.code));
        const filteredNew = newAlarms.filter((a) => !existingCodes.has(a.code));
        return [...filteredNew, ...prev].slice(0, 8);
      });
    }
  }, [tickCounter, selectedPatient]);

  /* ─────────────────────────────────────────────────────────────
   * Action Handlers & FDA Audit Log Signer
   * ───────────────────────────────────────────────────────────── */

  const logAuditAction = (
    category: AuditLogEntry['category'],
    action: string,
    deltaSummary: string
  ) => {
    const entry: AuditLogEntry = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      operator: 'Dr. A. Kakkar (Attending Intensivist / Perfusion ID: 9942)',
      category,
      action,
      deltaSummary,
      sha256Signature: `SHA256:${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const handleApplyOverrides = () => {
    setPatients((prev) =>
      prev.map((pt) => {
        if (pt.id !== selectedPatient.id) return pt;
        return {
          ...pt,
          pumpRPM: overrideRPM,
          sweepGasFlowLPM: overrideSweepFlow,
          sweepFiO2: overrideSweepFiO2,
          ventPEEP: overrideVentPEEP,
          ventPplat: overrideVentPplat,
          ventDrivingPressure: overrideVentPplat - overrideVentPEEP,
        };
      })
    );

    logAuditAction(
      'CIRCUIT',
      'Adjusted ECMO & Ventilator Gas Exchange Setpoints',
      `RPM: ${overrideRPM}, Sweep: ${overrideSweepFlow} L/min (${(overrideSweepFiO2 * 100).toFixed(0)}% FiO2), PEEP: ${overrideVentPEEP}, Pplat: ${overrideVentPplat}`
    );
  };

  const handleAcknowledgeAlarm = (id: string) => {
    setActiveAlarms((prev) =>
      prev.map((alm) => (alm.id === id ? { ...alm, acknowledged: true } : alm))
    );
    logAuditAction('SYSTEM', 'Silenced & Acknowledged Clinical Alert', `Alarm ID: ${id}`);
  };

  const handleExportCSV = () => {
    const history = telemetryHistory[selectedPatient.id] || [];
    if (history.length === 0) return;

    const headers = 'Timestamp,Tick,P1_mmHg,P2_mmHg,P3_mmHg,DeltaP_mmHg,Flow_LPM,RPM,SvO2_Percent,DrivingP_cmH2O,MechPower_Jmin\n';
    const rows = history
      .map(
        (h) =>
          `${h.timestamp},${h.tick},${h.p1},${h.p2},${h.p3},${h.deltaP},${h.flow},${h.rpm},${h.svO2},${h.drivingP},${h.mechPower}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ECMO_Telemetry_${selectedPatient.id}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    logAuditAction('SYSTEM', 'Exported FDA 21 CFR Part 11 Telemetry CSV', `Patient: ${selectedPatient.name} (${selectedPatient.id})`);
  };

  const handleExportFHIR = () => {
    const payload = {
      resourceType: 'Bundle',
      type: 'transaction',
      timestamp: new Date().toISOString(),
      patientRef: selectedPatient.id,
      patientName: selectedPatient.name,
      mrn: selectedPatient.mrn,
      activeAlarmsCount: activeAlarms.length,
      currentCircuitMetrics: {
        p1: selectedPatient.p1PrePump,
        p2: selectedPatient.p2PreOxy,
        p3: selectedPatient.p3PostOxy,
        deltaP: selectedPatient.transmembraneDeltaP,
        flow: selectedPatient.bloodFlowLPM,
        rpm: selectedPatient.pumpRPM,
        svO2: selectedPatient.svO2Percent,
      },
      auditCount: auditLogs.length,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HL7_FHIR_R4_ECMO_${selectedPatient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);

    logAuditAction('SYSTEM', 'Generated HL7 FHIR R4 DeviceObservation Bundle', `Patient: ${selectedPatient.id}`);
  };

  /* ─────────────────────────────────────────────────────────────
   * Computed Metrics & Color Status Helpers
   * ───────────────────────────────────────────────────────────── */

  const membraneResistance = useMemo(() => {
    if (!selectedPatient.bloodFlowLPM) return 0;
    return Number(((selectedPatient.transmembraneDeltaP / selectedPatient.bloodFlowLPM) * 13.33).toFixed(1));
  }, [selectedPatient.transmembraneDeltaP, selectedPatient.bloodFlowLPM]);

  const pF_ratio = useMemo(() => {
    return Math.round(selectedPatient.arterialPaO2 / selectedPatient.ventFiO2);
  }, [selectedPatient.arterialPaO2, selectedPatient.ventFiO2]);

  const historyPoints = telemetryHistory[selectedPatient.id] || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      {/* ────────────────── TOP CLINICAL APP HEADER ────────────────── */}
      <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
            <LifeBuoy className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Cardiopulmonary ECMO & Mechanical Ventilation Command Station
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                ELSO & ARDSNet Verified
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Extracorporeal Life Support Organization (ELSO) Tier-1 Surveillance &bull; FDA 21 CFR Part 11 Audit Trail &bull; Real-time Hemodynamic Interlocks
            </p>
          </div>
        </div>

        {/* Action Controls & Simulation Engine Tickers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Patient Selector */}
          <div className="relative">
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ecmoMode} &bull; {p.mrn})
                </option>
              ))}
            </select>
          </div>

          {/* Play/Pause & Speed Controller */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                isPlaying ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
              title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-1 text-xs rounded font-semibold transition ${
                  simSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Alarm Audio Toggle */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`p-2 rounded-lg border transition ${
              isAudioMuted
                ? 'bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
            }`}
            title={isAudioMuted ? 'Unmute Audio Alarms' : 'Mute Audio Alarms'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Export Actions */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </button>

          <button
            onClick={handleExportFHIR}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 rounded-lg transition"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            HL7 FHIR
          </button>

          {/* Emergency Protocol Trigger Button */}
          <button
            onClick={() => setIsEmergencyModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-950 transition animate-bounce"
          >
            <ShieldAlert className="w-4 h-4" />
            EMERGENCY PROTOCOLS
          </button>
        </div>
      </header>

      {/* ────────────────── PATIENT HERO STRIP ────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 my-4 bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
        <div className="col-span-1 lg:col-span-2 border-r border-slate-800/80 pr-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-white">{selectedPatient.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {selectedPatient.mrn}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
              {selectedPatient.ecmoMode}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {selectedPatient.diagnosis} &bull; {selectedPatient.age}y {selectedPatient.gender} ({selectedPatient.weightKg}kg / {selectedPatient.heightCm}cm)
          </p>
          <div className="text-[11px] text-cyan-400 mt-1 flex items-center gap-2">
            <span>Cannulation: Day {selectedPatient.daysOnECMO}</span>
            <span>&bull;</span>
            <span className="truncate">{selectedPatient.cannulaDrainage}</span>
          </div>
        </div>

        {/* Metric Pill 1: ECMO Flow & RPM */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>ECMO Blood Flow</span>
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-mono font-bold text-cyan-400">{selectedPatient.bloodFlowLPM.toFixed(2)}</span>
            <span className="text-xs text-slate-400">L/min</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {selectedPatient.pumpRPM} RPM &bull; {((selectedPatient.bloodFlowLPM * 1000) / selectedPatient.weightKg).toFixed(0)} mL/kg/min
          </div>
        </div>

        {/* Metric Pill 2: Transmembrane Delta P */}
        <div className={`p-2.5 rounded-lg border ${
          selectedPatient.transmembraneDeltaP >= 50
            ? 'bg-rose-950/40 border-rose-500/50'
            : 'bg-slate-950/60 border-slate-800/60'
        }`}>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Membrane Delta P</span>
            <Droplets className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-xl font-mono font-bold ${
              selectedPatient.transmembraneDeltaP >= 50 ? 'text-rose-400' : 'text-slate-100'
            }`}>
              {selectedPatient.transmembraneDeltaP}
            </span>
            <span className="text-xs text-slate-400">mmHg</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Res: {membraneResistance} Wood &bull; Normal &lt; 45
          </div>
        </div>

        {/* Metric Pill 3: Driving Pressure & Murray Score */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Driving Pressure</span>
            <Wind className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-xl font-mono font-bold ${
              selectedPatient.ventDrivingPressure > 14 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {selectedPatient.ventDrivingPressure}
            </span>
            <span className="text-xs text-slate-400">cmH2O</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Murray Score: {selectedPatient.murrayScore} &bull; Target &le; 12
          </div>
        </div>

        {/* Metric Pill 4: SvO2 & Anticoagulation Status */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>SvO2 & Anticoag</span>
            <Heart className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-mono font-bold text-rose-400">{selectedPatient.svO2Percent}%</span>
            <span className="text-xs text-slate-400">SvO2</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {selectedPatient.anticoagulant} &bull; ACT {selectedPatient.actSeconds}s (Anti-Xa {selectedPatient.antiXa})
          </div>
        </div>
      </section>

      {/* ────────────────── CRITICAL ACTIVE ALARMS BANNER ────────────────── */}
      {activeAlarms.length > 0 && (
        <section className="mb-4 space-y-2">
          {activeAlarms.slice(0, 2).map((alm) => (
            <div
              key={alm.id}
              className={`p-3 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                alm.severity === 'CRITICAL'
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                  : 'bg-amber-950/50 border-amber-500/50 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400 animate-pulse" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-wide">{alm.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 font-mono">
                      {alm.timestamp}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-0.5">{alm.message}</p>
                  <p className="text-xs font-semibold text-cyan-300 mt-0.5">
                    Recommended Action: {alm.action}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAcknowledgeAlarm(alm.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-slate-100 rounded-md transition whitespace-nowrap"
              >
                Acknowledge & Silence
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ────────────────── NAVIGATION TABS ────────────────── */}
      <nav className="flex items-center border-b border-slate-800 space-x-2 mb-6">
        {[
          { id: 'circuit', label: '1. Circuit Hemodynamics & Membrane Lung', icon: Gauge },
          { id: 'ventilation', label: '2. Lung-Protective Ventilation & Blood Gas', icon: Wind },
          { id: 'anticoag', label: '3. Anticoagulation & Clot Surveillance', icon: Syringe },
          { id: 'emergency', label: '4. Critical Emergency Interlocks', icon: ShieldAlert },
          { id: 'audit', label: '5. FDA 21 CFR Part 11 Audit Trail', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
                isActive
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ────────────────── TAB 1: CIRCUIT HEMODYNAMICS & OXYGENATOR ────────────────── */}
      {activeTab === 'circuit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual ECMO Circuit Schematic (SVG interactive) */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Workflow className="w-5 h-5 text-cyan-400" />
                Continuous Extracorporeal Flow Architecture ({selectedPatient.ecmoMode})
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                PMP Hollow-Fiber Membrane &bull; Centrifugal Mag-Lev Pump
              </span>
            </div>

            {/* SVG Circuit Visualizer */}
            <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden">
              <svg viewBox="0 0 800 300" className="w-full h-auto">
                <defs>
                  <linearGradient id="deoxGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                  <linearGradient id="oxyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                  <linearGradient id="memGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0891b2" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                </defs>

                {/* Deoxygenated Drainage Line */}
                <path
                  d="M 50 150 L 220 150"
                  stroke="url(#deoxGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  className="animate-pulse"
                />
                {/* Pre-Pump to Post-Pump Connector */}
                <path
                  d="M 280 150 L 400 150"
                  stroke="#2563eb"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                {/* Oxygenator to Reinfusion Line */}
                <path
                  d="M 540 150 L 750 150"
                  stroke="url(#oxyGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  className="animate-pulse"
                />

                {/* Sensor P1 (Drainage) */}
                <circle cx="140" cy="150" r="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                <text x="140" y="154" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
                  P1
                </text>
                <text x="140" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">
                  {selectedPatient.p1PrePump} mmHg
                </text>
                <text x="140" y="205" fill="#64748b" fontSize="9" textAnchor="middle">
                  Pre-Pump Drainage
                </text>

                {/* Centrifugal Pump Head */}
                <circle cx="250" cy="150" r="32" fill="#1e293b" stroke="#06b6d4" strokeWidth="3" />
                <circle cx="250" cy="150" r="14" fill="#0891b2" />
                <text x="250" y="153" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                  {selectedPatient.pumpRPM}
                </text>
                <text x="250" y="205" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
                  {selectedPatient.bloodFlowLPM.toFixed(2)} L/min
                </text>

                {/* Sensor P2 (Pre-Oxygenator) */}
                <circle cx="340" cy="150" r="18" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                <text x="340" y="154" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">
                  P2
                </text>
                <text x="340" y="190" fill="#f59e0b" fontSize="11" textAnchor="middle">
                  {selectedPatient.p2PreOxy} mmHg
                </text>
                <text x="340" y="205" fill="#64748b" fontSize="9" textAnchor="middle">
                  Pre-Membrane
                </text>

                {/* Membrane Oxygenator Unit */}
                <rect
                  x="420"
                  y="90"
                  width="110"
                  height="120"
                  rx="10"
                  fill="url(#memGrad)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                <text x="475" y="130" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
                  OXYGENATOR
                </text>
                <text x="475" y="148" fill="#e0f2fe" fontSize="10" textAnchor="middle">
                  ΔP: {selectedPatient.transmembraneDeltaP} mmHg
                </text>
                <text x="475" y="165" fill="#bae6fd" fontSize="9" textAnchor="middle">
                  Sweep: {selectedPatient.sweepGasFlowLPM} L/min
                </text>
                <text x="475" y="180" fill="#bae6fd" fontSize="9" textAnchor="middle">
                  FiO2: {(selectedPatient.sweepFiO2 * 100).toFixed(0)}%
                </text>

                {/* Sensor P3 (Post-Oxygenator) */}
                <circle cx="610" cy="150" r="18" fill="#0f172a" stroke="#ef4444" strokeWidth="2" />
                <text x="610" y="154" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">
                  P3
                </text>
                <text x="610" y="190" fill="#ef4444" fontSize="11" textAnchor="middle">
                  {selectedPatient.p3PostOxy} mmHg
                </text>
                <text x="610" y="205" fill="#64748b" fontSize="9" textAnchor="middle">
                  Post-Membrane
                </text>

                {/* Reinfusion Label */}
                <text x="730" y="135" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">
                  Arterial/Venous
                </text>
                <text x="730" y="180" fill="#94a3b8" fontSize="10" textAnchor="middle">
                  Reinfusion
                </text>
              </svg>
            </div>

            {/* Pressure Sensors Matrix Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">P1 (Inlet Suction)</div>
                <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">
                  {selectedPatient.p1PrePump} <span className="text-xs font-normal">mmHg</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Normal: -80 to -20 mmHg</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">P2 (Pre-Oxygenator)</div>
                <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                  {selectedPatient.p2PreOxy} <span className="text-xs font-normal">mmHg</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Normal: 120 to 260 mmHg</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">P3 (Post-Oxygenator)</div>
                <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">
                  {selectedPatient.p3PostOxy} <span className="text-xs font-normal">mmHg</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Normal: 90 to 220 mmHg</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Transmembrane ΔP</div>
                <div className={`text-lg font-mono font-bold mt-0.5 ${
                  selectedPatient.transmembraneDeltaP >= 50 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}>
                  {selectedPatient.transmembraneDeltaP} <span className="text-xs font-normal">mmHg</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Limit: &lt; 45 mmHg</div>
              </div>
            </div>
          </div>

          {/* Telemetry Control Panel & Setpoint Modifiers */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                ECMO Console Setpoint Calibration
              </h3>

              <div className="space-y-4 text-xs">
                {/* Pump RPM Slider */}
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Centrifugal Pump RPM</span>
                    <span className="font-mono text-cyan-400">{overrideRPM} RPM</span>
                  </div>
                  <input
                    type="range"
                    min="1500"
                    max="5500"
                    step="50"
                    value={overrideRPM}
                    onChange={(e) => setOverrideRPM(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>1500 RPM</span>
                    <span>Expected Flow: ~{(overrideRPM / 800).toFixed(2)} L/min</span>
                    <span>5500 RPM</span>
                  </div>
                </div>

                {/* Sweep Gas Flow Slider */}
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Sweep Gas Flow (PaCO2 Clearance)</span>
                    <span className="font-mono text-amber-400">{overrideSweepFlow.toFixed(1)} L/min</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="15.0"
                    step="0.1"
                    value={overrideSweepFlow}
                    onChange={(e) => setOverrideSweepFlow(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>0.5 L/min (Apneic)</span>
                    <span>Ratio ~{(overrideSweepFlow / selectedPatient.bloodFlowLPM).toFixed(1)}:1</span>
                    <span>15.0 L/min</span>
                  </div>
                </div>

                {/* Sweep FiO2 Slider */}
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Sweep Gas Oxygen Fraction (FiO2)</span>
                    <span className="font-mono text-emerald-400">{(overrideSweepFiO2 * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.21"
                    max="1.0"
                    step="0.01"
                    value={overrideSweepFiO2}
                    onChange={(e) => setOverrideSweepFiO2(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>21% (Room Air)</span>
                    <span>Target PaO2: 80 - 150 mmHg</span>
                    <span>100% O2</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-6">
              <button
                onClick={handleApplyOverrides}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md shadow-cyan-950 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply Console Calibration & Record Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 2: LUNG-PROTECTIVE VENTILATION & GAS EXCHANGE ────────────────── */}
      {activeTab === 'ventilation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ventilator Setting Matrix & Mechanical Power */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Wind className="w-5 h-5 text-amber-400" />
              ARDSNet Lung-Rest Mechanical Ventilation Telemetry
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Ultra-protective resting strategy to minimize Ventilator-Induced Lung Injury (VILI), volutrauma, and ergotrauma while ECMO manages systemic metabolic gas exchange.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Driving Pressure Gauge Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-semibold">Driving Pressure (ΔP_vent)</div>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                  {selectedPatient.ventDrivingPressure} <span className="text-xs font-normal text-slate-400">cmH2O</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Pplat ({selectedPatient.ventPplat}) - PEEP ({selectedPatient.ventPEEP})</div>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      selectedPatient.ventDrivingPressure > 14 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (selectedPatient.ventDrivingPressure / 20) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Safe Lung Rest Limit: &le; 12 cmH2O</div>
              </div>

              {/* Mechanical Power Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-semibold">Mechanical Power (Gattinoni)</div>
                <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">
                  {selectedPatient.mechanicalPower} <span className="text-xs font-normal text-slate-400">J/min</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Cumulative Lung Energy Load</div>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      selectedPatient.mechanicalPower > 17 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, (selectedPatient.mechanicalPower / 25) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Target: &lt; 17 J/min</div>
              </div>

              {/* P/F Ratio & Murray Score */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400 font-semibold">PaO2 / FiO2 Ratio</div>
                <div className="text-2xl font-mono font-bold text-rose-400 mt-1">
                  {pF_ratio} <span className="text-xs font-normal text-slate-400">mmHg</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Murray Score: {selectedPatient.murrayScore} / 4.0</div>
                <div className="text-[10px] text-slate-400 mt-3 font-semibold">
                  Berlin ARDS Criteria: {pF_ratio < 100 ? 'Severe Hypoxemic ARDS' : 'Moderate ARDS'}
                </div>
              </div>
            </div>

            {/* Blood Gas Comparative Analytical Matrix */}
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-rose-400" />
              Tri-Point Blood Gas Comparison (Arterial vs Venous vs Post-Oxygenator)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Sampling Site</th>
                    <th className="p-2.5">pH</th>
                    <th className="p-2.5">pO2 (mmHg)</th>
                    <th className="p-2.5">pCO2 (mmHg)</th>
                    <th className="p-2.5">sO2 (%)</th>
                    <th className="p-2.5">Lactate (mmol/L)</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-sans font-semibold text-rose-300">Systemic Arterial</td>
                    <td className="p-2.5">7.38</td>
                    <td className="p-2.5 text-cyan-400">{selectedPatient.arterialPaO2}</td>
                    <td className="p-2.5 text-amber-400">{selectedPatient.arterialPaCO2}</td>
                    <td className="p-2.5">97.2%</td>
                    <td className="p-2.5">1.4</td>
                    <td className="p-2.5 font-sans text-emerald-400">Adequate Tissue Delivery</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-sans font-semibold text-indigo-300">Mixed Venous (SvO2)</td>
                    <td className="p-2.5">7.32</td>
                    <td className="p-2.5">38</td>
                    <td className="p-2.5">48</td>
                    <td className="p-2.5 text-rose-400 font-bold">{selectedPatient.svO2Percent}%</td>
                    <td className="p-2.5">1.6</td>
                    <td className="p-2.5 font-sans text-cyan-400">Target &gt; 70%</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-sans font-semibold text-cyan-300">Post-Membrane O2</td>
                    <td className="p-2.5">7.46</td>
                    <td className="p-2.5 text-cyan-300 font-bold">{selectedPatient.postOxyPaO2}</td>
                    <td className="p-2.5 text-emerald-400 font-bold">{selectedPatient.postOxyPaCO2}</td>
                    <td className="p-2.5">100%</td>
                    <td className="p-2.5">1.4</td>
                    <td className="p-2.5 font-sans text-emerald-400">Membrane Gas Exchange Optimal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Ventilator Settings Override Panel */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                Lung-Rest Ventilator Titration
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Positive End-Expiratory Pressure (PEEP)</span>
                    <span className="font-mono text-cyan-400">{overrideVentPEEP} cmH2O</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="22"
                    step="1"
                    value={overrideVentPEEP}
                    onChange={(e) => setOverrideVentPEEP(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>5 cmH2O</span>
                    <span>Recommended: 10 - 14 cmH2O</span>
                    <span>22 cmH2O</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Plateau Pressure (Pplat)</span>
                    <span className="font-mono text-amber-400">{overrideVentPplat} cmH2O</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="35"
                    step="1"
                    value={overrideVentPplat}
                    onChange={(e) => setOverrideVentPplat(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>12 cmH2O</span>
                    <span>Resulting ΔP: {overrideVentPplat - overrideVentPEEP} cmH2O</span>
                    <span>35 cmH2O</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-300">Ultra-Protective Venting Rules:</div>
                  <div className="text-[10px] text-slate-400">&bull; Target Vt: 3-4 mL/kg PBW (Predicted Body Weight)</div>
                  <div className="text-[10px] text-slate-400">&bull; Respiratory Rate: 6 - 10 bpm resting rate</div>
                  <div className="text-[10px] text-slate-400">&bull; FiO2: &le; 0.40 to mitigate hyperoxic atelectasis</div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-6">
              <button
                onClick={handleApplyOverrides}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md shadow-amber-950 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Commit Ventilator Titration Setpoints
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 3: ANTICOAGULATION & CLOT SURVEILLANCE ────────────────── */}
      {activeTab === 'anticoag' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Syringe className="w-5 h-5 text-rose-400" />
              ELSO Anticoagulation & Thromboelastography (TEG) Dashboard
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Real-time surveillance of circuit thrombosis risks versus patient bleeding diathesis.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Activated Clotting Time</div>
                <div className="text-xl font-mono font-bold text-cyan-400 mt-1">
                  {selectedPatient.actSeconds} <span className="text-xs font-normal">sec</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Target: 180 - 210 sec</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Anti-Factor Xa</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                  {selectedPatient.antiXa.toFixed(2)} <span className="text-xs font-normal">IU/mL</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Target: 0.30 - 0.50 IU/mL</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Plasma Free Hemoglobin</div>
                <div className={`text-xl font-mono font-bold mt-1 ${
                  selectedPatient.plasmaFreeHbMgDl > 25 ? 'text-rose-400' : 'text-slate-100'
                }`}>
                  {selectedPatient.plasmaFreeHbMgDl} <span className="text-xs font-normal">mg/dL</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Hemolysis Limit: &lt; 30 mg/dL</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Fibrinogen / Platelets</div>
                <div className="text-xl font-mono font-bold text-amber-400 mt-1">
                  {selectedPatient.fibrinogenMgDl} <span className="text-xs font-normal">mg/dL</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Plt: {(selectedPatient.platelets / 1000).toFixed(0)}k/uL</div>
              </div>
            </div>

            {/* TEG Clot Kinetics Graphic Representation */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-200">TEG 6s Hemostasis Waveform Analysis</span>
                <span className="text-[10px] text-cyan-400 font-mono">Kaolin / Heparinase Channel Active</span>
              </div>
              <div className="relative h-28 w-full bg-slate-900/50 rounded-lg flex items-center justify-center overflow-hidden border border-slate-800/80">
                {/* SVG TEG Spindle Curve */}
                <svg viewBox="0 0 500 100" className="w-full h-full">
                  <path
                    d="M 20 50 L 100 50 Q 150 15 250 10 Q 380 15 480 35 L 480 65 Q 380 85 250 90 Q 150 85 100 50 Z"
                    fill="rgba(56, 189, 248, 0.15)"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                  <line x1="20" y1="50" x2="480" y2="50" stroke="#475569" strokeDasharray="3 3" />
                  <text x="60" y="42" fill="#94a3b8" fontSize="9">R-Time: 7.2 min</text>
                  <text x="200" y="28" fill="#38bdf8" fontSize="9">Angle α: 64°</text>
                  <text x="250" y="48" fill="#f59e0b" fontSize="10" fontWeight="bold">MA: 58 mm</text>
                  <text x="400" y="42" fill="#94a3b8" fontSize="9">LY30: 1.2%</text>
                </svg>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-400 mt-2">
                <div>R-Time: Clot Initiation</div>
                <div>K / α-Angle: Clot Kinetics</div>
                <div>MA: Platelet/Fibrin Strength</div>
                <div>LY30: Fibrinolysis Index</div>
              </div>
            </div>
          </div>

          {/* Anticoagulation Protocol Titrator */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                Active Anticoagulant Infusion Protocol
              </h3>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Agent:</span>
                  <span className="font-bold text-white">{selectedPatient.anticoagulant}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Current Infusion Rate:</span>
                  <span className="font-mono text-cyan-400 font-bold">{selectedPatient.infusionRate}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Reversal Agent:</span>
                  <span className="text-amber-400 font-semibold">
                    {selectedPatient.anticoagulant === 'UFH' ? 'Protamine Sulfate' : 'Discontinue Infusion / Cryo'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-lg text-xs space-y-1">
                <div className="font-bold text-cyan-300">Clinical Protocol Guidance:</div>
                <p className="text-slate-300 text-[11px]">
                  If Anti-Xa is &lt; 0.30 IU/mL, administer 40 units/kg heparin bolus and increase rate by 2 units/kg/hr. Re-check anti-Xa in 4 hours.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-6">
              <button
                onClick={() => logAuditAction('ANTICOAGULATION', 'Titrated Anticoagulant Dose', `Adjusted ${selectedPatient.anticoagulant} infusion based on anti-Xa`)}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition shadow-md shadow-rose-950"
              >
                Log Anticoagulation Adjustment Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 4: CRITICAL EMERGENCY PROTOCOLS ────────────────── */}
      {activeTab === 'emergency' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              ELSO Standardized Emergency Action Stations
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Step-by-step critical emergency execution checklists with safety interlocks and electronic action timestamps.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  id: 'CIRCUIT_THROMBOSIS',
                  title: 'Acute Circuit Thrombosis',
                  severity: 'CRITICAL',
                  trigger: 'Delta P > 55 mmHg or PaO2 drop',
                  icon: Droplets,
                },
                {
                  id: 'AIR_EMBOLISM',
                  title: 'Air Embolism in Reinfusion Line',
                  severity: 'CRITICAL',
                  trigger: 'Bubble Detector Ultrasonic Trigger',
                  icon: Wind,
                },
                {
                  id: 'DECANNULATION',
                  title: 'Emergency Decannulation / Disconnect',
                  severity: 'CRITICAL',
                  trigger: 'Flow Collapse + Hemorrhage',
                  icon: AlertTriangle,
                },
                {
                  id: 'HARLEQUIN',
                  title: 'North-South Differential Hypoxemia',
                  severity: 'HIGH_RISK',
                  trigger: 'Right Arm SpO2 < 88% on VA-ECMO',
                  icon: Heart,
                },
              ].map((proto) => {
                const Icon = proto.icon;
                return (
                  <div
                    key={proto.id}
                    className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-rose-500/50 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          proto.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {proto.severity}
                        </span>
                        <Icon className="w-4 h-4 text-rose-400" />
                      </div>
                      <h3 className="font-bold text-sm text-white">{proto.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">Trigger: {proto.trigger}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedEmergencyProtocol(proto.id);
                        setIsEmergencyModalOpen(true);
                      }}
                      className="mt-4 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition"
                    >
                      Execute Protocol Checklist
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 5: FDA 21 CFR PART 11 AUDIT TRAIL ────────────────── */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                FDA 21 CFR Part 11 Cryptographic Audit Trail
              </h2>
              <p className="text-xs text-slate-400">
                Immutable chronological log of all operator actions, calibration setpoint changes, and emergency protocol activations.
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Download Audit Ledger
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
                <tr>
                  <th className="p-3">Timestamp (UTC)</th>
                  <th className="p-3">Operator ID</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Action Description</th>
                  <th className="p-3">Parameter Modifications</th>
                  <th className="p-3">SHA-256 Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500 font-sans">
                      No audit entries recorded for current session yet. Make parameter adjustments to record entries.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-300">{log.timestamp}</td>
                      <td className="p-3 text-cyan-300">{log.operator}</td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                          {log.category}
                        </span>
                      </td>
                      <td className="p-3 font-sans font-semibold text-slate-200">{log.action}</td>
                      <td className="p-3 text-amber-300">{log.deltaSummary}</td>
                      <td className="p-3 text-slate-500 text-[10px]">{log.sha256Signature}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: EMERGENCY PROTOCOL CHECKLIST INSPECTOR ────────────────── */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-lg">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <h3>Emergency Clinical Protocol Action Console</h3>
              </div>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Execute the mandatory clinical steps below in sequence. Every checkbox action is timestamped and cryptographically signed into the FDA 21 CFR Part 11 audit ledger.
              </p>

              <div className="space-y-2">
                {[
                  '1. Notify ECMO Specialist, Perfusionist, and Attending Intensivist immediately via code pager.',
                  '2. Verify backup console pre-primed circuit pressure transducers and heater-cooler lines.',
                  '3. Elevate mechanical ventilator FiO2 to 1.0 and adjust backup respiratory rate to 20 bpm.',
                  '4. Apply dual-clamp technique at 45-degree angle on drainage and reinfusion limbs.',
                  '5. Transfer blood pump head to backup motor drive, de-air purge ports, and unclamp.',
                  '6. Verify post-exchange Delta P (< 30 mmHg) and draw post-oxygenator blood gas panel.',
                ].map((step, idx) => {
                  const stepKey = `STEP_${idx}`;
                  const isChecked = !!completedChecklistSteps[stepKey];
                  return (
                    <label
                      key={stepKey}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        isChecked
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const nextState = e.target.checked;
                          setCompletedChecklistSteps((prev) => ({ ...prev, [stepKey]: nextState }));
                          logAuditAction(
                            'EMERGENCY_PROTOCOL',
                            nextState ? 'Completed Protocol Step' : 'Unchecked Protocol Step',
                            step
                          );
                        }}
                        className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-400"
                      />
                      <span className="text-xs leading-relaxed">{step}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsEmergencyModalOpen(false);
                  logAuditAction('EMERGENCY_PROTOCOL', 'Emergency Protocol Execution Session Concluded', 'All checklist items verified.');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition"
              >
                Conclude & Seal Emergency Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
