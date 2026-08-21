import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Baby,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Download,
  Droplet,
  Droplets,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Gauge,
  Heart,
  HeartPulse,
  HelpCircle,
  History,
  Info,
  Layers,
  Lock,
  Pause,
  Percent,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stethoscope,
  Syringe,
  Terminal,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Unlock,
  Volume2,
  VolumeX,
  Wind,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

/* ─────────────────────────── Types & Interfaces ─────────────────────────── */

export interface PediatricPatient {
  id: string;
  name: string;
  ageMonths: number;
  ageDisplay: string;
  gender: 'Male' | 'Female' | 'Other';
  ageGroup: 'NEONATE' | 'INFANT' | 'TODDLER' | 'PRESCHOOL' | 'SCHOOL_AGE' | 'ADOLESCENT';
  weightKg: number;
  bedNumber: string;
  primaryDiagnosis: string;
  admissionDate: string;
  heartRate: number; // bpm
  respiratoryRate: number; // breaths/min
  systolicBp: number; // mmHg
  diastolicBp: number; // mmHg
  meanArterialPressure: number; // mmHg
  spo2: number; // %
  temperatureCelsius: number; // °C
  capillaryRefillSec: number; // seconds
  behaviorScore: number; // 0 - 3
  cardiovascularScore: number; // 0 - 3
  respiratoryScore: number; // 0 - 3
  nebulizerBonus: boolean;
  persistentVomiting: boolean;
  pewsScore: number; // 0 - 13
  respiratorySupportType: 'ROOM_AIR' | 'LOW_FLOW_CANNULA' | 'HFNC' | 'CPAP_BIPAP' | 'MECHANICAL_VENTILATION';
  fio2Percent: number; // 21 - 100%
  hfncFlowLpm: number; // L/min
  invasiveVentilator: {
    mode: string;
    pip: number; // cmH2O
    peep: number; // cmH2O
    tidalVolumeMl: number;
    meanAirwayPressure: number; // cmH2O
  };
  pao2: number; // mmHg
  paco2: number; // mmHg
  arterialPh: number;
  lactate: number; // mmol/L
  visScore: number; // Vasoactive Inotropic Score
  sedationRass: number; // Richmond Agitation-Sedation Scale (-5 to +4)
  urineOutputLastHourMl: number;
  fluidBalance24hMl: number;
  activeAlerts: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    timestamp: string;
  }>;
}

export interface PediatricTelemetryLog {
  timestamp: string;
  patientId: string;
  patientName: string;
  ageDisplay: string;
  pewsScore: number;
  heartRate: number;
  respiratoryRate: number;
  systolicBp: number;
  meanArterialPressure: number;
  spo2: number;
  visScore: number;
  lactate: number;
  respiratorySupport: string;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

/* ─────────────────────────── Initial Patient Data ─────────────────────────── */

const INITIAL_PEDIATRIC_PATIENTS: PediatricPatient[] = [
  {
    id: 'PAT-PICU-101',
    name: 'Leo Chen',
    ageMonths: 3.5,
    ageDisplay: '3.5 months',
    gender: 'Male',
    ageGroup: 'INFANT',
    weightKg: 5.4,
    bedNumber: 'PICU-Pod-01',
    primaryDiagnosis: 'Severe RSV Bronchiolitis with Impending Respiratory Failure',
    admissionDate: '2026-08-20',
    heartRate: 172,
    respiratoryRate: 58,
    systolicBp: 78,
    diastolicBp: 44,
    meanArterialPressure: 55,
    spo2: 91,
    temperatureCelsius: 38.8,
    capillaryRefillSec: 3.5,
    behaviorScore: 2,
    cardiovascularScore: 1,
    respiratoryScore: 2,
    nebulizerBonus: true,
    persistentVomiting: false,
    pewsScore: 7,
    respiratorySupportType: 'HFNC',
    fio2Percent: 60,
    hfncFlowLpm: 12.0,
    invasiveVentilator: {
      mode: 'OFF',
      pip: 0,
      peep: 0,
      tidalVolumeMl: 0,
      meanAirwayPressure: 0,
    },
    pao2: 68,
    paco2: 56,
    arterialPh: 7.26,
    lactate: 2.8,
    visScore: 0,
    sedationRass: -1,
    urineOutputLastHourMl: 7.2,
    fluidBalance24hMl: 140,
    activeAlerts: [
      { id: 'ALT-101-1', severity: 'CRITICAL', message: 'PEWS Score 7: Impending Respiratory Exhaustion - Intubation Equipment Primed at Bedside', timestamp: '5 min ago' },
      { id: 'ALT-101-2', severity: 'HIGH', message: 'Severe Respiratory Acidosis (pH 7.26, PaCO2 56 mmHg) under HFNC 12 L/min', timestamp: '20 min ago' }
    ]
  },
  {
    id: 'PAT-PICU-102',
    name: 'Maya Rodriguez',
    ageMonths: 0.45,
    ageDisplay: '14 days (Neonate)',
    gender: 'Female',
    ageGroup: 'NEONATE',
    weightKg: 3.2,
    bedNumber: 'NICU-Isolette-04',
    primaryDiagnosis: 'Hypoplastic Left Heart Syndrome (HLHS) post-Stage 1 Norwood Reconstruction',
    admissionDate: '2026-08-19',
    heartRate: 154,
    respiratoryRate: 38,
    systolicBp: 64,
    diastolicBp: 36,
    meanArterialPressure: 45,
    spo2: 81,
    temperatureCelsius: 36.9,
    capillaryRefillSec: 2.5,
    behaviorScore: 1,
    cardiovascularScore: 2,
    respiratoryScore: 1,
    nebulizerBonus: false,
    persistentVomiting: false,
    pewsScore: 4,
    respiratorySupportType: 'MECHANICAL_VENTILATION',
    fio2Percent: 35,
    hfncFlowLpm: 0,
    invasiveVentilator: {
      mode: 'PRVC',
      pip: 18,
      peep: 5,
      tidalVolumeMl: 20,
      meanAirwayPressure: 9.5,
    },
    pao2: 44,
    paco2: 40,
    arterialPh: 7.38,
    lactate: 3.1,
    visScore: 17.5,
    sedationRass: -3,
    urineOutputLastHourMl: 4.8,
    fluidBalance24hMl: 65,
    activeAlerts: [
      { id: 'ALT-102-1', severity: 'HIGH', message: 'Single Ventricle Qp:Qs Balance Monitoring (SpO2 Target 75-85% Active)', timestamp: '15 min ago' },
      { id: 'ALT-102-2', severity: 'MEDIUM', message: 'Milrinone (0.5 mcg/kg/min) + Epinephrine (0.05 mcg/kg/min) infusion active', timestamp: '1 hour ago' }
    ]
  },
  {
    id: 'PAT-PICU-103',
    name: 'Noah Gallagher',
    ageMonths: 48,
    ageDisplay: '4.0 years',
    gender: 'Male',
    ageGroup: 'PRESCHOOL',
    weightKg: 16.5,
    bedNumber: 'PICU-Pod-03',
    primaryDiagnosis: 'Meningococcal Septic Shock with Refractory Vasodilatory Hypotension',
    admissionDate: '2026-08-21',
    heartRate: 168,
    respiratoryRate: 34,
    systolicBp: 72,
    diastolicBp: 38,
    meanArterialPressure: 49,
    spo2: 95,
    temperatureCelsius: 39.4,
    capillaryRefillSec: 4.5,
    behaviorScore: 3,
    cardiovascularScore: 3,
    respiratoryScore: 1,
    nebulizerBonus: false,
    persistentVomiting: true,
    pewsScore: 9,
    respiratorySupportType: 'MECHANICAL_VENTILATION',
    fio2Percent: 50,
    hfncFlowLpm: 0,
    invasiveVentilator: {
      mode: 'SIMV-PC',
      pip: 22,
      peep: 8,
      tidalVolumeMl: 110,
      meanAirwayPressure: 13.0,
    },
    pao2: 88,
    paco2: 35,
    arterialPh: 7.18,
    lactate: 6.8,
    visScore: 32.0,
    sedationRass: -4,
    urineOutputLastHourMl: 6.0,
    fluidBalance24hMl: 1450,
    activeAlerts: [
      { id: 'ALT-103-1', severity: 'CRITICAL', message: 'PHOENIX SEPSIS ALERT: Fluid-Refractory Septic Shock (Lactate 6.8 mmol/L, VIS 32.0)', timestamp: '2 min ago' },
      { id: 'ALT-103-2', severity: 'CRITICAL', message: 'Severe Hypotension (MAP 49 mmHg) - Norepinephrine up-titration indicated', timestamp: '12 min ago' }
    ]
  },
  {
    id: 'PAT-PICU-104',
    name: 'Sophia Patel',
    ageMonths: 96,
    ageDisplay: '8.0 years',
    gender: 'Female',
    ageGroup: 'SCHOOL_AGE',
    weightKg: 28.0,
    bedNumber: 'PICU-Pod-05',
    primaryDiagnosis: 'Refractory Status Epilepticus post-Burst Suppression Protocol',
    admissionDate: '2026-08-20',
    heartRate: 88,
    respiratoryRate: 16,
    systolicBp: 104,
    diastolicBp: 62,
    meanArterialPressure: 76,
    spo2: 99,
    temperatureCelsius: 37.1,
    capillaryRefillSec: 1.5,
    behaviorScore: 0,
    cardiovascularScore: 0,
    respiratoryScore: 0,
    nebulizerBonus: false,
    persistentVomiting: false,
    pewsScore: 1,
    respiratorySupportType: 'MECHANICAL_VENTILATION',
    fio2Percent: 30,
    hfncFlowLpm: 0,
    invasiveVentilator: {
      mode: 'PRVC',
      pip: 16,
      peep: 5,
      tidalVolumeMl: 195,
      meanAirwayPressure: 8.5,
    },
    pao2: 120,
    paco2: 38,
    arterialPh: 7.41,
    lactate: 1.2,
    visScore: 0,
    sedationRass: -5,
    urineOutputLastHourMl: 42.0,
    fluidBalance24hMl: 320,
    activeAlerts: [
      { id: 'ALT-104-1', severity: 'LOW', message: 'Continuous cEEG monitoring active: 90% Burst Suppression maintained', timestamp: '45 min ago' }
    ]
  }
];

/* ─────────────────────────── Component Main ─────────────────────────── */

export const PediatricICUTelemetryPage: React.FC = () => {
  // State Management
  const [patients, setPatients] = useState<PediatricPatient[]>(INITIAL_PEDIATRIC_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PAT-PICU-101');
  const [activeTab, setActiveTab] = useState<'overview' | 'respiratory' | 'hemodynamics' | 'sepsis' | 'fluids' | 'telemetry' | 'protocols'>('overview');

  // Real-time Engine State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [audioAlarmsEnabled, setAudioAlarmsEnabled] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('ALL');

  // Interactive Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Edit State for Inotropes / Ventilation
  const [editEpi, setEditEpi] = useState<number>(0);
  const [editNorepi, setEditNorepi] = useState<number>(0);
  const [editMilrinone, setEditMilrinone] = useState<number>(0);
  const [editVaso, setEditVaso] = useState<number>(0);
  const [editFiO2, setEditFiO2] = useState<number>(60);
  const [editFlowLpm, setEditFlowLpm] = useState<number>(12);

  // Telemetry History Log
  const [telemetryLogs, setTelemetryLogs] = useState<PediatricTelemetryLog[]>([]);

  // Active Patient Derived State
  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Synchronize modal edit fields
  useEffect(() => {
    if (activePatient) {
      setEditFiO2(activePatient.fio2Percent);
      setEditFlowLpm(activePatient.hfncFlowLpm);
    }
  }, [selectedPatientId]);

  // Derived Holliday-Segar Maintenance Rate (mL/h)
  const maintenanceFluidRate = useMemo(() => {
    const w = activePatient.weightKg;
    if (w <= 10) return Number((w * 4).toFixed(1));
    if (w <= 20) return Number((40 + (w - 10) * 2).toFixed(1));
    return Number((60 + (w - 20) * 1).toFixed(1));
  }, [activePatient.weightKg]);

  // Derived 20 mL/kg Resuscitation Bolus
  const resuscitationBolus20MlKg = useMemo(() => {
    return Math.round(activePatient.weightKg * 20);
  }, [activePatient.weightKg]);

  // Derived Oxygenation Index (OI)
  const oxygenationIndex = useMemo(() => {
    if (
      activePatient.respiratorySupportType === 'MECHANICAL_VENTILATION' &&
      activePatient.invasiveVentilator.meanAirwayPressure > 0 &&
      activePatient.pao2 > 0
    ) {
      return Number(
        ((activePatient.invasiveVentilator.meanAirwayPressure * activePatient.fio2Percent) / activePatient.pao2).toFixed(1)
      );
    }
    return null;
  }, [activePatient]);

  // Real-time Tick Loop Engine
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTickCount((prev) => prev + 1);

      setPatients((prevPatients) => {
        return prevPatients.map((p) => {
          const noise = (Math.random() - 0.5) * 2;
          const newHR = Math.min(220, Math.max(50, Math.round(p.heartRate + noise * 1.8)));
          const newRR = Math.min(80, Math.max(10, Math.round(p.respiratoryRate + noise * 1.2)));
          const newSBP = Math.min(150, Math.max(45, Math.round(p.systolicBp + noise * 1.0)));
          const newDBP = Math.min(95, Math.max(25, Math.round(p.diastolicBp + noise * 0.8)));
          const newMAP = Math.round(newDBP + (newSBP - newDBP) / 3);
          const newSpO2 = Math.min(100, Math.max(70, Math.round(p.spo2 + (noise > 0 ? 0.3 : -0.3))));

          // Recalculate PEWS score
          let cvScore = 0;
          if (newHR > 160 || newMAP < 50 || p.capillaryRefillSec >= 4) cvScore = 2;
          else if (newHR > 140 || p.capillaryRefillSec >= 3) cvScore = 1;

          let respScore = 0;
          if (newRR > 55 || newSpO2 < 92) respScore = 2;
          else if (newRR > 40 || newSpO2 < 95) respScore = 1;

          let totalPEWS = p.behaviorScore + cvScore + respScore;
          if (p.nebulizerBonus) totalPEWS += 2;
          if (p.persistentVomiting) totalPEWS += 2;

          return {
            ...p,
            heartRate: newHR,
            respiratoryRate: newRR,
            systolicBp: newSBP,
            diastolicBp: newDBP,
            meanArterialPressure: newMAP,
            spo2: newSpO2,
            cardiovascularScore: cvScore,
            respiratoryScore: respScore,
            pewsScore: totalPEWS,
          };
        });
      });
    }, 1500 / simSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed]);

  // Log Telemetry snapshot
  useEffect(() => {
    if (tickCount === 0 || !activePatient) return;

    if (tickCount % 4 === 0) {
      const now = new Date().toLocaleTimeString();
      const status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' =
        activePatient.pewsScore >= 7 || activePatient.visScore >= 25 || activePatient.lactate >= 5.0
          ? 'CRITICAL'
          : activePatient.pewsScore >= 4 || activePatient.visScore >= 10
          ? 'WARNING'
          : 'OPTIMAL';

      const entry: PediatricTelemetryLog = {
        timestamp: now,
        patientId: activePatient.id,
        patientName: activePatient.name,
        ageDisplay: activePatient.ageDisplay,
        pewsScore: activePatient.pewsScore,
        heartRate: activePatient.heartRate,
        respiratoryRate: activePatient.respiratoryRate,
        systolicBp: activePatient.systolicBp,
        meanArterialPressure: activePatient.meanArterialPressure,
        spo2: activePatient.spo2,
        visScore: activePatient.visScore,
        lactate: activePatient.lactate,
        respiratorySupport: activePatient.respiratorySupportType,
        status,
      };

      setTelemetryLogs((prev) => [entry, ...prev.slice(0, 49)]);
    }
  }, [tickCount, activePatient]);

  // CSV Export Utility
  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Patient ID',
      'Patient Name',
      'Age',
      'PEWS Score',
      'Heart Rate (bpm)',
      'Respiratory Rate (rpm)',
      'Systolic BP (mmHg)',
      'MAP (mmHg)',
      'SpO2 (%)',
      'VIS Score',
      'Lactate (mmol/L)',
      'Respiratory Support',
      'Status',
    ];

    const rows = telemetryLogs.map((log) => [
      log.timestamp,
      log.patientId,
      `"${log.patientName}"`,
      `"${log.ageDisplay}"`,
      log.pewsScore,
      log.heartRate,
      log.respiratoryRate,
      log.systolicBp,
      log.meanArterialPressure,
      log.spo2,
      log.visScore,
      log.lactate,
      log.respiratorySupport,
      log.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pediatric_ICU_Telemetry_${activePatient.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Vasoactive Inotrope Update Handler
  const handleSaveInotropes = () => {
    const newVIS = editEpi * 100 + editNorepi * 100 + editMilrinone * 10 + editVaso * 10000;
    setPatients((prev) =>
      prev.map((p) => (p.id === activePatient.id ? { ...p, visScore: Number(newVIS.toFixed(1)) } : p))
    );
    setModalFeedback(`Vasoactive-Inotrope Score recalculated: VIS = ${newVIS.toFixed(1)}`);
    setTimeout(() => {
      setModalFeedback(null);
      setActiveModal(null);
    }, 1200);
  };

  // Respiratory Support Update Handler
  const handleSaveRespiratory = () => {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === activePatient.id
          ? {
              ...p,
              fio2Percent: editFiO2,
              hfncFlowLpm: editFlowLpm,
            }
          : p
      )
    );
    setModalFeedback('Pediatric respiratory parameters verified and delivered.');
    setTimeout(() => {
      setModalFeedback(null);
      setActiveModal(null);
    }, 1200);
  };

  // Emergency Protocol Execution
  const handleTriggerEmergencyProtocol = (protocol: string) => {
    let msg = '';
    if (protocol === 'CODE_PINK') {
      msg = 'STAT PEDIATRIC RAPID RESPONSE / CODE PINK ACTIVATED: Pediatric airway team, RT, and PICU Fellow en route.';
      setPatients((prev) =>
        prev.map((p) =>
          p.id === activePatient.id
            ? {
                ...p,
                activeAlerts: [
                  { id: `ALT-${Date.now()}`, severity: 'CRITICAL', message: 'CODE PINK ACTIVATED - Bedside Intubation & Video Laryngoscopy Prepped', timestamp: 'Just now' },
                  ...p.activeAlerts,
                ],
              }
            : p
        )
      );
    } else if (protocol === 'SEPSIS_BOLUS') {
      msg = `20 mL/kg RESUSCITATION FLUID BOLUS (${resuscitationBolus20MlKg} mL Plasmalyte) DISPATCHED over 15 minutes.`;
      setPatients((prev) =>
        prev.map((p) =>
          p.id === activePatient.id
            ? {
                ...p,
                systolicBp: p.systolicBp + 8,
                meanArterialPressure: p.meanArterialPressure + 6,
                capillaryRefillSec: Math.max(1.5, p.capillaryRefillSec - 1.0),
                fluidBalance24hMl: p.fluidBalance24hMl + resuscitationBolus20MlKg,
                activeAlerts: [
                  { id: `ALT-${Date.now()}`, severity: 'HIGH', message: `20 mL/kg Fluid Bolus (${resuscitationBolus20MlKg} mL) Infused`, timestamp: 'Just now' },
                  ...p.activeAlerts,
                ],
              }
            : p
        )
      );
    } else if (protocol === 'INOTROPE_EMERGENCY') {
      msg = 'EMERGENCY EPINEPHRINE TITRATION: Epinephrine push-dose (0.1 mcg/kg/min) started via central line.';
      setPatients((prev) =>
        prev.map((p) =>
          p.id === activePatient.id
            ? {
                ...p,
                visScore: p.visScore + 10,
                meanArterialPressure: p.meanArterialPressure + 10,
                activeAlerts: [
                  { id: `ALT-${Date.now()}`, severity: 'HIGH', message: 'Epinephrine Emergency Titration Infusing', timestamp: 'Just now' },
                  ...p.activeAlerts,
                ],
              }
            : p
        )
      );
    }

    setModalFeedback(msg);
    setTimeout(() => {
      setModalFeedback(null);
      setActiveModal(null);
    }, 2000);
  };

  // Filtered Patients List
  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.primaryDiagnosis.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterAgeGroup === 'ALL') return matchesSearch;
    return matchesSearch && p.ageGroup === filterAgeGroup;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* ─────────────────────────── Top Navigation Bar ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shadow-inner">
              <Baby className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Pediatric ICU & Neonatal Critical Care Command Station
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/30">
                  Phoenix Sepsis 2024 / PALS / FDA 21 CFR Part 11
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Age-Adjusted Hemodynamics, PEWS Early Warning Stratification, Vasoactive-Inotrope Titration & High-Flow Oxygenation
              </p>
            </div>
          </div>

          {/* Real-time Controls */}
          <div className="flex items-center space-x-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shadow-inner">
            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800/80">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-medium text-emerald-400">PEDIATRIC STREAM</span>
              <span className="text-xs font-mono text-slate-400">T+{tickCount}</span>
            </div>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition-all ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Resume'}</span>
            </button>

            {/* Sim Speed */}
            <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium transition-all ${
                    simSpeed === spd
                      ? 'bg-pink-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Audio Alarm */}
            <button
              onClick={() => setAudioAlarmsEnabled(!audioAlarmsEnabled)}
              className={`p-2 rounded-lg text-xs transition-all ${
                audioAlarmsEnabled
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-900 border border-slate-800'
              }`}
            >
              {audioAlarmsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium flex items-center space-x-1.5 transition-all shadow"
            >
              <Download className="h-3.5 w-3.5 text-pink-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Clinical Overview & PEWS', icon: Activity },
            { id: 'respiratory', label: 'Respiratory & Oxygenation (OI/OSI)', icon: Wind },
            { id: 'hemodynamics', label: 'Hemodynamics & Inotropes (VIS)', icon: HeartPulse },
            { id: 'sepsis', label: 'Phoenix Sepsis Criteria 2024', icon: Flame },
            { id: 'fluids', label: 'Holliday-Segar Fluid Resuscitation', icon: Droplets },
            { id: 'telemetry', label: 'Real-time Telemetry Stream', icon: Terminal },
            { id: 'protocols', label: 'Code Pink & Emergency Interlocks', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-transparent'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-pink-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ─────────────────────────── Pediatric Patient Carousel ─────────────────────────── */}
      <section className="px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="flex items-center space-x-2">
            <Baby className="h-4 w-4 text-pink-400" />
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Active PICU & NICU Cohort ({filteredPatients.length} Beds)
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search child, bed, diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 w-56"
              />
            </div>
            <select
              value={filterAgeGroup}
              onChange={(e) => setFilterAgeGroup(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-pink-500"
            >
              <option value="ALL">All Age Brackets</option>
              <option value="NEONATE">Neonates (0-28d)</option>
              <option value="INFANT">Infants (1-12m)</option>
              <option value="PRESCHOOL">Preschool (4-5y)</option>
              <option value="SCHOOL_AGE">School-Age (6-11y)</option>
            </select>
          </div>
        </div>

        {/* Patient Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPatients.map((p) => {
            const isSelected = p.id === activePatient.id;
            const isCritical = p.pewsScore >= 7 || p.visScore >= 25;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 border-pink-500 shadow-lg shadow-pink-950/40 ring-1 ring-pink-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-100">{p.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-pink-300 border border-slate-700">
                        {p.bedNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={p.primaryDiagnosis}>
                      {p.ageDisplay} • {p.weightKg} kg
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.pewsScore >= 7
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : p.pewsScore >= 4
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    PEWS {p.pewsScore}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">HR (bpm)</span>
                    <span className="font-mono font-bold text-slate-100">{p.heartRate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">SpO2 (%)</span>
                    <span
                      className={`font-mono font-bold ${
                        p.spo2 < 92 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {p.spo2}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">VIS Score</span>
                    <span
                      className={`font-mono font-bold ${
                        p.visScore >= 15 ? 'text-rose-400' : p.visScore > 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {p.visScore}
                    </span>
                  </div>
                </div>

                {/* PEWS Escalation Bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>Clinical Decompensation Risk</span>
                    <span className={`font-mono font-bold ${p.pewsScore >= 7 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {p.pewsScore}/13
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        p.pewsScore >= 7 ? 'bg-rose-500' : p.pewsScore >= 4 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (p.pewsScore / 13) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────── Main Diagnostic Summary ─────────────────────────── */}
      <main className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="h-14 w-14 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 font-mono text-lg font-bold shadow-inner">
                {activePatient.bedNumber.split('-')[1] || 'PICU'}
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-slate-100">{activePatient.name}</h3>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {activePatient.id} • {activePatient.ageDisplay} • {activePatient.gender} • {activePatient.weightKg} kg
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      activePatient.pewsScore >= 7
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : activePatient.pewsScore >= 4
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    PEWS {activePatient.pewsScore} ({activePatient.pewsScore >= 7 ? 'Critical Decompensation' : 'Guarded'})
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-500">Diagnosis:</span> {activePatient.primaryDiagnosis}
                </p>
                <p className="text-xs text-pink-400 mt-0.5 font-medium">
                  <span className="text-slate-500">Respiratory Mode:</span> {activePatient.respiratorySupportType} (FiO2 {activePatient.fio2Percent}%)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveModal('INOTROPE_CONFIG')}
                className="px-4 py-2 rounded-xl bg-pink-500 text-slate-950 font-semibold text-xs flex items-center space-x-2 hover:bg-pink-400 transition-all shadow-md shadow-pink-950/50"
              >
                <Syringe className="h-3.5 w-3.5" />
                <span>Titrate Vasoactive Inotropes</span>
              </button>

              <button
                onClick={() => setActiveModal('RESPIRATORY_CONFIG')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center space-x-2 hover:bg-slate-700 transition-all shadow"
              >
                <Wind className="h-3.5 w-3.5 text-cyan-400" />
                <span>Ventilator / HFNC Config</span>
              </button>

              <button
                onClick={() => setActiveModal('CODE_PINK_ACTIONS')}
                className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-xs flex items-center space-x-2 hover:bg-rose-500/30 transition-all shadow"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Code Pink Emergency</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-800/80">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Heart Rate</span>
                <Heart className="h-3 w-3 text-rose-400" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-slate-100">{activePatient.heartRate}</span>
                <span className="text-[10px] text-slate-400">bpm</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Ref: 90-160 (Infant)</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Blood Pressure</span>
                <Gauge className="h-3 w-3 text-cyan-400" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-slate-100">
                  {activePatient.systolicBp}/{activePatient.diastolicBp}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">(MAP {activePatient.meanArterialPressure})</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target MAP &gt; 50</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>SpO2 / FiO2</span>
                <Wind className="h-3 w-3 text-pink-400" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-pink-400">{activePatient.spo2}%</span>
                <span className="text-[10px] text-slate-400">@{activePatient.fio2Percent}% FiO2</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Support: {activePatient.respiratorySupportType}</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Inotrope Score (VIS)</span>
                <Syringe className="h-3 w-3 text-amber-400" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span
                  className={`text-lg font-mono font-bold ${
                    activePatient.visScore >= 25 ? 'text-rose-400' : activePatient.visScore > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {activePatient.visScore}
                </span>
                <span className="text-[10px] text-slate-400">VIS</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target &lt; 10</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Capillary Refill</span>
                <Clock className="h-3 w-3 text-cyan-400" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span
                  className={`text-lg font-mono font-bold ${
                    activePatient.capillaryRefillSec > 2.0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {activePatient.capillaryRefillSec}s
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">&lt; 2.0s normal</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Maintenance Fluid</span>
                <Droplet className="h-3 w-3 text-cyan-400" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-cyan-400">{maintenanceFluidRate}</span>
                <span className="text-[10px] text-slate-400">mL/h</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Bolus: {resuscitationBolus20MlKg} mL</span>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── Tab View: Overview ─────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* PEWS Escalation Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Scale className="h-4 w-4 text-pink-400" />
                      <h4 className="text-sm font-semibold text-slate-200">PEWS Early Warning Matrix</h4>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                        activePatient.pewsScore >= 7
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      SCORE {activePatient.pewsScore}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Behavior Sub-Score</span>
                        <span className="font-mono font-bold text-slate-200">{activePatient.behaviorScore} / 3</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {activePatient.behaviorScore === 3 ? 'Lethargic / Stuporous' : activePatient.behaviorScore === 2 ? 'Irritable / Consolable with effort' : 'Appropriate / Calm'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Cardiovascular Sub-Score</span>
                        <span className="font-mono font-bold text-slate-200">{activePatient.cardiovascularScore} / 3</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Cap refill {activePatient.capillaryRefillSec}s • HR {activePatient.heartRate} bpm
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Respiratory Sub-Score</span>
                        <span className="font-mono font-bold text-slate-200">{activePatient.respiratoryScore} / 3</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        RR {activePatient.respiratoryRate} rpm • FiO2 {activePatient.fio2Percent}% • Tracheal tugging
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Nursing Escalation</span>
                  <span className="font-mono font-semibold text-rose-400">q15m Vitals &amp; Airway Standby</span>
                </div>
              </div>

              {/* Respiratory Mechanics */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Wind className="h-4 w-4 text-cyan-400" />
                      <h4 className="text-sm font-semibold text-slate-200">Pediatric Respiratory Kinetics</h4>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                      {activePatient.respiratorySupportType}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">PaO2 / FiO2 Ratio</span>
                      <span className="font-mono font-bold text-slate-100">
                        {activePatient.pao2 ? Math.round(activePatient.pao2 / (activePatient.fio2Percent / 100)) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Arterial PaCO2 (Ventilation)</span>
                      <span className="font-mono font-bold text-amber-400">{activePatient.paco2} mmHg</span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Arterial Blood pH</span>
                      <span className="font-mono font-bold text-rose-400">{activePatient.arterialPh}</span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Oxygenation Index (OI)</span>
                      <span className="font-mono font-bold text-pink-400">{oxygenationIndex || 'Non-Invasive'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">PARDS Severity</span>
                  <span className="font-mono font-semibold text-amber-300">Moderate Pediatric ARDS</span>
                </div>
              </div>

              {/* Vasoactive Inotropes & Perfusion */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Syringe className="h-4 w-4 text-pink-400" />
                      <h4 className="text-sm font-semibold text-slate-200">Perfusion & Inotrope Metrics</h4>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                        activePatient.visScore >= 15 ? 'text-rose-400' : 'text-slate-200'
                      }`}
                    >
                      VIS {activePatient.visScore}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Arterial Serum Lactate</span>
                        <span
                          className={`font-mono font-bold ${
                            activePatient.lactate >= 4.0 ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          {activePatient.lactate} mmol/L
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">&lt; 2.0 mmol/L normal clearance</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Hourly Urine Output Rate</span>
                        <span className="font-mono font-bold text-slate-200">
                          {(activePatient.urineOutputLastHourMl / activePatient.weightKg).toFixed(2)} mL/kg/h
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">&gt; 1.0 mL/kg/h pediatric target</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Shock State</span>
                  <span className="font-mono font-semibold text-emerald-400">Compensated / Fluid Responsive</span>
                </div>
              </div>
            </div>

            {/* Active Clinical Alerts Feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Flame className="h-4 w-4 text-rose-400" />
                  <h4 className="text-sm font-semibold text-slate-200">Pediatric Critical Care Alarms &amp; Sentinel Alerts</h4>
                </div>
                <span className="text-xs text-slate-400">{activePatient.activeAlerts.length} Active System Alerts</span>
              </div>

              <div className="space-y-2.5">
                {activePatient.activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-rose-950/30 border-rose-800 text-rose-200'
                        : alert.severity === 'HIGH'
                        ? 'bg-amber-950/30 border-amber-800 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <AlertTriangle
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          alert.severity === 'CRITICAL'
                            ? 'text-rose-400'
                            : alert.severity === 'HIGH'
                            ? 'text-amber-400'
                            : 'text-pink-400'
                        }`}
                      />
                      <div>
                        <span className="text-xs font-semibold block">{alert.message}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{alert.timestamp}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : alert.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────── Tab View: Telemetry Stream ─────────────────────────── */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-100">Pediatric High-Frequency Telemetry Log</h4>
                  <p className="text-xs text-slate-400">
                    Chronological micro-stream of vital signs, inotrope demands, and respiratory kinetics.
                  </p>
                </div>
                <span className="text-xs text-pink-400 font-mono">{telemetryLogs.length} Records in Memory</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Age</th>
                      <th className="py-2.5 px-3">PEWS</th>
                      <th className="py-2.5 px-3">HR (bpm)</th>
                      <th className="py-2.5 px-3">RR (rpm)</th>
                      <th className="py-2.5 px-3">BP / MAP</th>
                      <th className="py-2.5 px-3">SpO2 (%)</th>
                      <th className="py-2.5 px-3">VIS</th>
                      <th className="py-2.5 px-3">Lactate</th>
                      <th className="py-2.5 px-3">Respiratory</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {telemetryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-500 font-sans">
                          Waiting for live pediatric telemetry ticks...
                        </td>
                      </tr>
                    ) : (
                      telemetryLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-2 px-3 text-slate-400">{log.timestamp}</td>
                          <td className="py-2 px-3 text-slate-200 font-sans font-medium">{log.patientName}</td>
                          <td className="py-2 px-3 text-pink-400">{log.ageDisplay}</td>
                          <td className="py-2 px-3 font-bold text-amber-300">{log.pewsScore}</td>
                          <td className="py-2 px-3">{log.heartRate}</td>
                          <td className="py-2 px-3">{log.respiratoryRate}</td>
                          <td className="py-2 px-3">
                            {log.systolicBp} ({log.meanArterialPressure})
                          </td>
                          <td className="py-2 px-3 text-cyan-300">{log.spo2}%</td>
                          <td className="py-2 px-3 font-bold">{log.visScore}</td>
                          <td className="py-2 px-3">{log.lactate}</td>
                          <td className="py-2 px-3 text-slate-400">{log.respiratorySupport}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                log.status === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : log.status === 'WARNING'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────── Tab View: Protocols ─────────────────────────── */}
        {activeTab === 'protocols' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-100">Code Pink / Pediatric Airway STAT</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Dispatches PICU resuscitation team, prepares weight-adjusted endotracheal tube (Uncuffed: Age/4 + 4), video laryngoscopy, and RSI pharmacotherapy.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerEmergencyProtocol('CODE_PINK')}
                  className="mt-5 w-full py-2.5 rounded-xl bg-rose-500 text-slate-950 font-bold text-xs hover:bg-rose-400 transition-all shadow-md shadow-rose-950/50"
                >
                  Trigger Code Pink Airway
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-100">20 mL/kg Sepsis Fluid Bolus</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Delivers {resuscitationBolus20MlKg} mL isotonic crystalloid rapid pressure infusion over 15 minutes for hypoperfusion / prolonged cap refill.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerEmergencyProtocol('SEPSIS_BOLUS')}
                  className="mt-5 w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all shadow-md shadow-cyan-950/50"
                >
                  Infuse {resuscitationBolus20MlKg} mL Bolus
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <Syringe className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-100">Inotrope Push-Dose Surge</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Administers weight-based Epinephrine (0.1 mcg/kg/min) continuous infusion titration for fluid-refractory septic/cardiogenic shock.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerEmergencyProtocol('INOTROPE_EMERGENCY')}
                  className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-950/50"
                >
                  Ramp Inotrope Infusion
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────── Interactive Modal: Inotropes ─────────────────────────── */}
      {activeModal === 'INOTROPE_CONFIG' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Syringe className="h-5 w-5 text-pink-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Titrate Vasoactive Inotropes (Weight: {activePatient.weightKg} kg)
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold">
                {modalFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Epinephrine (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={editEpi}
                  onChange={(e) => setEditEpi(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Norepinephrine (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.0"
                  value={editNorepi}
                  onChange={(e) => setEditNorepi(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Milrinone (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="0.75"
                  value={editMilrinone}
                  onChange={(e) => setEditMilrinone(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Vasopressin (units/kg/min)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="0.002"
                  value={editVaso}
                  onChange={(e) => setEditVaso(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInotropes}
                className="px-5 py-2 rounded-xl bg-pink-500 text-slate-950 text-xs font-bold hover:bg-pink-400 transition-all shadow"
              >
                Calculate &amp; Apply VIS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────── Interactive Modal: Respiratory ─────────────────────────── */}
      {activeModal === 'RESPIRATORY_CONFIG' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Wind className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">Adjust High-Flow Oxygenation Parameters</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold">
                {modalFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Delivered FiO2 (%)</label>
                <input
                  type="number"
                  min="21"
                  max="100"
                  value={editFiO2}
                  onChange={(e) => setEditFiO2(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">HFNC Flow (L/min)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={editFlowLpm}
                  onChange={(e) => setEditFlowLpm(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRespiratory}
                className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-all shadow"
              >
                Update Respiratory Setting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────── Interactive Modal: Code Pink ─────────────────────────── */}
      {activeModal === 'CODE_PINK_ACTIONS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <h3 className="text-base font-bold text-rose-300">Pediatric Critical Emergency Interlocks</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalFeedback && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-semibold">
                {modalFeedback}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleTriggerEmergencyProtocol('CODE_PINK')}
                className="w-full p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-left hover:bg-rose-950/60 transition-all"
              >
                <span className="text-xs font-bold text-rose-300 block">STAT Code Pink Airway Activation</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Broadcasts emergency pager to Attending Intensivist and primes bedside video laryngoscope.
                </span>
              </button>

              <button
                onClick={() => handleTriggerEmergencyProtocol('SEPSIS_BOLUS')}
                className="w-full p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/80 text-left hover:bg-cyan-950/60 transition-all"
              >
                <span className="text-xs font-bold text-cyan-300 block">
                  20 mL/kg Crystalloid Bolus ({resuscitationBolus20MlKg} mL)
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Rapid fluid resuscitation for pediatric septic shock.
                </span>
              </button>

              <button
                onClick={() => handleTriggerEmergencyProtocol('INOTROPE_EMERGENCY')}
                className="w-full p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-left hover:bg-amber-950/60 transition-all"
              >
                <span className="text-xs font-bold text-amber-300 block">Epinephrine Continuous Infusion Start</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Initiates cold shock inotropic support at 0.1 mcg/kg/min.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PediatricICUTelemetryPage;
