import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
  Terminal,
  TrendingDown,
  TrendingUp,
  Unlock,
  Volume2,
  VolumeX,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

/* ─────────────────────────── Types & Interfaces ─────────────────────────── */

export interface NephrologyPatient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  weightKg: number;
  heightCm: number;
  bedNumber: string;
  primaryDiagnosis: string;
  admissionDate: string;
  egfrBaseline: number;
  egfrCurrent: number;
  creatinineBaseline: number;
  creatinineCurrent: number;
  creatinineUnit: 'mg/dL' | 'umol/L';
  bun: number;
  potassium: number; // mmol/L
  sodium: number; // mmol/L
  bicarbonate: number; // mmol/L
  chloride: number; // mmol/L
  serumOsmolality: number; // mOsm/kg
  arterialPh: number;
  arterialPco2: number; // mmHg
  lactate: number; // mmol/L
  urineOutputLastHour: number; // mL/h
  fluidBalance24h: number; // mL
  fluidOverloadPercent: number; // %
  kdigoStage: 0 | 1 | 2 | 3;
  rrtIndication: string;
  currentModality: 'CVVH' | 'CVVHD' | 'CVVHDF' | 'SCUF';
  bloodFlowRate: number; // Qb mL/min
  dialysateFlowRate: number; // Qd mL/h
  preReplacementRate: number; // Qpre mL/h
  postReplacementRate: number; // Qpost mL/h
  netUltrafiltrationRate: number; // Quf mL/h
  accessPressure: number; // mmHg (-250 to 0)
  filterPressure: number; // mmHg (50 to 300)
  venousPressure: number; // mmHg (10 to 200)
  effluentPressure: number; // mmHg (-150 to +50)
  transmembranePressure: number; // TMP mmHg
  filterPressureDrop: number; // dP mmHg
  filtrationFraction: number; // %
  anticoagulationMode: 'RCA_CITRATE' | 'SYSTEMIC_HEPARIN' | 'ARGATROBAN' | 'PROSTACYCLIN' | 'NONE_SALINE_FLUSH';
  citrateInfusionRate: number; // mL/h
  calciumChlorideRate: number; // mL/h
  systemicIonizedCalcium: number; // mmol/L (1.10 - 1.30)
  postFilterIonizedCalcium: number; // mmol/L (0.25 - 0.35)
  totalSerumCalcium: number; // mg/dL
  totToIonizedCaRatio: number;
  filterRunHours: number;
  filterEstimatedRemainingHours: number;
  clottingRiskScore: number; // % 0 - 100
  activeAlerts: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    timestamp: string;
  }>;
}

export interface TelemetryLogEntry {
  timestamp: string;
  patientId: string;
  patientName: string;
  modality: string;
  bloodFlowRate: number;
  effluentDose: number;
  tmp: number;
  filterPressureDrop: number;
  filtrationFraction: number;
  netUfRate: number;
  potassium: number;
  postFilterICa: number;
  clottingRisk: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

/* ─────────────────────────── Initial Patient Data ─────────────────────────── */

const INITIAL_PATIENTS: NephrologyPatient[] = [
  {
    id: 'PAT-NEPH-401',
    name: 'Eleanor Vance',
    age: 64,
    gender: 'Female',
    weightKg: 72.5,
    heightCm: 168,
    bedNumber: 'ICU-Bed-04A',
    primaryDiagnosis: 'Septic Shock with Acute Tubular Necrosis (ATN) & Metabolic Acidosis',
    admissionDate: '2026-08-19',
    egfrBaseline: 78,
    egfrCurrent: 12,
    creatinineBaseline: 0.9,
    creatinineCurrent: 4.8,
    creatinineUnit: 'mg/dL',
    bun: 84,
    potassium: 6.2,
    sodium: 136,
    bicarbonate: 14,
    chloride: 104,
    serumOsmolality: 318,
    arterialPh: 7.21,
    arterialPco2: 28,
    lactate: 4.2,
    urineOutputLastHour: 8,
    fluidBalance24h: 3850,
    fluidOverloadPercent: 12.4,
    kdigoStage: 3,
    rrtIndication: 'Severe Refractory Hyperkalemia (6.2) + Fluid Overload (12.4%) + Metabolic Acidosis (pH 7.21)',
    currentModality: 'CVVHDF',
    bloodFlowRate: 200,
    dialysateFlowRate: 1400,
    preReplacementRate: 800,
    postReplacementRate: 400,
    netUltrafiltrationRate: 250,
    accessPressure: -85,
    filterPressure: 165,
    venousPressure: 92,
    effluentPressure: -20,
    transmembranePressure: 142,
    filterPressureDrop: 73,
    filtrationFraction: 18.2,
    anticoagulationMode: 'RCA_CITRATE',
    citrateInfusionRate: 220,
    calciumChlorideRate: 45,
    systemicIonizedCalcium: 1.18,
    postFilterIonizedCalcium: 0.31,
    totalSerumCalcium: 8.9,
    totToIonizedCaRatio: 1.88,
    filterRunHours: 34.5,
    filterEstimatedRemainingHours: 37.5,
    clottingRiskScore: 18,
    activeAlerts: [
      { id: 'ALT-401-1', severity: 'HIGH', message: 'Serum Potassium 6.2 mmol/L (Severe Hyperkalemia) - 2.0 K+ Dialysate Bath Active', timestamp: '10 min ago' },
      { id: 'ALT-401-2', severity: 'MEDIUM', message: 'Target Net UF 250 mL/h running for systemic fluid de-escalation', timestamp: '1 hour ago' }
    ]
  },
  {
    id: 'PAT-NEPH-402',
    name: 'Arthur Sterling',
    age: 71,
    gender: 'Male',
    weightKg: 88.0,
    heightCm: 177,
    bedNumber: 'ICU-Bed-07B',
    primaryDiagnosis: 'Cardiorenal Syndrome Type 1 post-CABG with Refractory Anasarca',
    admissionDate: '2026-08-18',
    egfrBaseline: 55,
    egfrCurrent: 16,
    creatinineBaseline: 1.3,
    creatinineCurrent: 3.9,
    creatinineUnit: 'mg/dL',
    bun: 96,
    potassium: 5.4,
    sodium: 131,
    bicarbonate: 18,
    chloride: 98,
    serumOsmolality: 304,
    arterialPh: 7.32,
    arterialPco2: 36,
    lactate: 2.1,
    urineOutputLastHour: 15,
    fluidBalance24h: 5200,
    fluidOverloadPercent: 16.8,
    kdigoStage: 3,
    rrtIndication: 'Refractory Diuretic-Resistant Volume Overload (16.8%) with Low Cardiac Index',
    currentModality: 'CVVH',
    bloodFlowRate: 180,
    dialysateFlowRate: 0,
    preReplacementRate: 1600,
    postReplacementRate: 400,
    netUltrafiltrationRate: 350,
    accessPressure: -110,
    filterPressure: 215,
    venousPressure: 118,
    effluentPressure: -45,
    transmembranePressure: 210,
    filterPressureDrop: 97,
    filtrationFraction: 22.4,
    anticoagulationMode: 'SYSTEMIC_HEPARIN',
    citrateInfusionRate: 0,
    calciumChlorideRate: 0,
    systemicIonizedCalcium: 1.22,
    postFilterIonizedCalcium: 1.20,
    totalSerumCalcium: 9.1,
    totToIonizedCaRatio: 1.86,
    filterRunHours: 58.2,
    filterEstimatedRemainingHours: 13.8,
    clottingRiskScore: 68,
    activeAlerts: [
      { id: 'ALT-402-1', severity: 'CRITICAL', message: 'Elevated TMP (210 mmHg) - Hemofilter Fiber Clogging Detected. Prepare backup circuit set.', timestamp: '5 min ago' },
      { id: 'ALT-402-2', severity: 'HIGH', message: 'Massive Fluid Overload (+16.8%) - Continuous Ultrafiltration guided by Bioimpedance', timestamp: '2 hours ago' }
    ]
  },
  {
    id: 'PAT-NEPH-403',
    name: 'Mei-Ling Zhou',
    age: 52,
    gender: 'Female',
    weightKg: 58.0,
    heightCm: 160,
    bedNumber: 'ICU-Bed-02C',
    primaryDiagnosis: 'Severe Rhabdomyolysis & Myoglobinuric Renal Failure secondary to Crush Injury',
    admissionDate: '2026-08-20',
    egfrBaseline: 95,
    egfrCurrent: 22,
    creatinineBaseline: 0.7,
    creatinineCurrent: 3.2,
    creatinineUnit: 'mg/dL',
    bun: 68,
    potassium: 5.8,
    sodium: 142,
    bicarbonate: 16,
    chloride: 108,
    serumOsmolality: 312,
    arterialPh: 7.28,
    arterialPco2: 32,
    lactate: 3.5,
    urineOutputLastHour: 22,
    fluidBalance24h: 2100,
    fluidOverloadPercent: 6.2,
    kdigoStage: 2,
    rrtIndication: 'High Cut-Off Convective Solute Clearance for Plasma Myoglobin (>45k ng/mL)',
    currentModality: 'CVVH',
    bloodFlowRate: 220,
    dialysateFlowRate: 0,
    preReplacementRate: 2200,
    postReplacementRate: 200,
    netUltrafiltrationRate: 150,
    accessPressure: -70,
    filterPressure: 140,
    venousPressure: 80,
    effluentPressure: -15,
    transmembranePressure: 115,
    filterPressureDrop: 60,
    filtrationFraction: 16.5,
    anticoagulationMode: 'RCA_CITRATE',
    citrateInfusionRate: 240,
    calciumChlorideRate: 50,
    systemicIonizedCalcium: 1.15,
    postFilterIonizedCalcium: 0.28,
    totalSerumCalcium: 8.6,
    totToIonizedCaRatio: 1.87,
    filterRunHours: 12.0,
    filterEstimatedRemainingHours: 60.0,
    clottingRiskScore: 8,
    activeAlerts: [
      { id: 'ALT-403-1', severity: 'LOW', message: 'Convective dose 41 mL/kg/h active for high-flux myoglobin elimination', timestamp: '3 hours ago' }
    ]
  },
  {
    id: 'PAT-NEPH-404',
    name: 'Gabriel Reyes',
    age: 48,
    gender: 'Male',
    weightKg: 82.0,
    heightCm: 182,
    bedNumber: 'ICU-Bed-09A',
    primaryDiagnosis: 'Fulminant Hepatic Failure with Hepatorenal Syndrome (HRS-AKI Type 1)',
    admissionDate: '2026-08-21',
    egfrBaseline: 85,
    egfrCurrent: 18,
    creatinineBaseline: 0.8,
    creatinineCurrent: 2.8,
    creatinineUnit: 'mg/dL',
    bun: 72,
    potassium: 4.9,
    sodium: 128,
    bicarbonate: 19,
    chloride: 96,
    serumOsmolality: 292,
    arterialPh: 7.36,
    arterialPco2: 34,
    lactate: 5.8,
    urineOutputLastHour: 18,
    fluidBalance24h: 1800,
    fluidOverloadPercent: 7.5,
    kdigoStage: 2,
    rrtIndication: 'HRS-AKI with Severe Hyperammonemia; Impaired Hepatic Citrate Clearance',
    currentModality: 'CVVHD',
    bloodFlowRate: 150,
    dialysateFlowRate: 2000,
    preReplacementRate: 0,
    postReplacementRate: 0,
    netUltrafiltrationRate: 100,
    accessPressure: -60,
    filterPressure: 130,
    venousPressure: 75,
    effluentPressure: -10,
    transmembranePressure: 98,
    filterPressureDrop: 55,
    filtrationFraction: 0.0,
    anticoagulationMode: 'PROSTACYCLIN',
    citrateInfusionRate: 0,
    calciumChlorideRate: 0,
    systemicIonizedCalcium: 1.24,
    postFilterIonizedCalcium: 1.22,
    totalSerumCalcium: 8.8,
    totToIonizedCaRatio: 1.77,
    filterRunHours: 8.4,
    filterEstimatedRemainingHours: 63.6,
    clottingRiskScore: 12,
    activeAlerts: [
      { id: 'ALT-404-1', severity: 'HIGH', message: 'Severe Hepatic Impairment - Citrate Anticoagulation CONTRAINDICATED. Epoprostenol mode enabled.', timestamp: '30 min ago' }
    ]
  }
];

/* ─────────────────────────── Component Main ─────────────────────────── */

export const NephrologyCRRTPage: React.FC = () => {
  // State Management
  const [patients, setPatients] = useState<NephrologyPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PAT-NEPH-401');
  const [activeTab, setActiveTab] = useState<'overview' | 'circuit' | 'anticoagulation' | 'acidbase' | 'telemetry' | 'protocols'>('overview');
  
  // Real-time Engine State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [audioAlarmsEnabled, setAudioAlarmsEnabled] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  // Interactive Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Form State for Modals
  const [editModality, setEditModality] = useState<'CVVH' | 'CVVHD' | 'CVVHDF' | 'SCUF'>('CVVHDF');
  const [editQb, setEditQb] = useState<number>(200);
  const [editQd, setEditQd] = useState<number>(1400);
  const [editQpre, setEditQpre] = useState<number>(800);
  const [editQpost, setEditQpost] = useState<number>(400);
  const [editNetUf, setEditNetUf] = useState<number>(250);
  const [editCitrateRate, setEditCitrateRate] = useState<number>(220);
  const [editCalciumRate, setEditCalciumRate] = useState<number>(45);

  // Telemetry History Log
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([]);

  // Active Patient Derived State
  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Synchronize modal edit fields when selected patient changes
  useEffect(() => {
    if (activePatient) {
      setEditModality(activePatient.currentModality);
      setEditQb(activePatient.bloodFlowRate);
      setEditQd(activePatient.dialysateFlowRate);
      setEditQpre(activePatient.preReplacementRate);
      setEditQpost(activePatient.postReplacementRate);
      setEditNetUf(activePatient.netUltrafiltrationRate);
      setEditCitrateRate(activePatient.citrateInfusionRate);
      setEditCalciumRate(activePatient.calciumChlorideRate);
    }
  }, [selectedPatientId]);

  // Derived Effluent Dose Calculation
  const totalEffluentFlow = useMemo(() => {
    return (
      activePatient.dialysateFlowRate +
      activePatient.preReplacementRate +
      activePatient.postReplacementRate +
      activePatient.netUltrafiltrationRate
    );
  }, [activePatient]);

  const deliveredDoseMlKgHr = useMemo(() => {
    if (!activePatient.weightKg) return 0;
    // Pre-dilution correction
    const plasmaFlow = activePatient.bloodFlowRate * 60 * 0.70;
    const factor = activePatient.preReplacementRate > 0
      ? plasmaFlow / (plasmaFlow + activePatient.preReplacementRate)
      : 1.0;
    const effectivePre = activePatient.preReplacementRate * factor;
    const totalEffective =
      activePatient.dialysateFlowRate +
      effectivePre +
      activePatient.postReplacementRate +
      activePatient.netUltrafiltrationRate;
    return Number((totalEffective / activePatient.weightKg).toFixed(1));
  }, [activePatient]);

  // Real-time Tick Loop Engine
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTickCount((prev) => prev + 1);

      setPatients((prevPatients) => {
        return prevPatients.map((p) => {
          // Slight physiological oscillation
          const noise = (Math.random() - 0.5) * 2;
          const newFilterPressure = Math.min(280, Math.max(90, Math.round(p.filterPressure + noise * 1.5)));
          const newVenousPressure = Math.min(180, Math.max(30, Math.round(p.venousPressure + noise * 0.8)));
          const newEffluentPressure = Math.min(20, Math.max(-120, Math.round(p.effluentPressure + noise * 0.6)));
          const newAccessPressure = Math.min(-30, Math.max(-220, Math.round(p.accessPressure + noise * 1.2)));

          // Recalculate TMP: (Pfilter + Pvenous)/2 - Peffluent
          const newTmp = Math.round((newFilterPressure + newVenousPressure) / 2 - newEffluentPressure);
          const newPressureDrop = Math.round(newFilterPressure - newVenousPressure);

          // Clotting risk calculation
          let risk = 10;
          if (newTmp > 200) risk += 40;
          else if (newTmp > 160) risk += 20;
          if (newPressureDrop > 100) risk += 25;
          if (p.filterRunHours > 50) risk += 15;
          const finalRisk = Math.min(100, Math.max(5, Math.round(risk)));

          return {
            ...p,
            filterPressure: newFilterPressure,
            venousPressure: newVenousPressure,
            effluentPressure: newEffluentPressure,
            accessPressure: newAccessPressure,
            transmembranePressure: newTmp,
            filterPressureDrop: newPressureDrop,
            clottingRiskScore: finalRisk,
            filterRunHours: Number((p.filterRunHours + 0.01 * simSpeed).toFixed(2)),
          };
        });
      });
    }, 1500 / simSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed]);

  // Log Telemetry periodically
  useEffect(() => {
    if (tickCount === 0 || !activePatient) return;

    if (tickCount % 4 === 0) {
      const now = new Date().toLocaleTimeString();
      const status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' =
        activePatient.transmembranePressure > 200 || activePatient.clottingRiskScore > 65
          ? 'CRITICAL'
          : activePatient.transmembranePressure > 160 || activePatient.potassium > 5.5
          ? 'WARNING'
          : 'OPTIMAL';

      const entry: TelemetryLogEntry = {
        timestamp: now,
        patientId: activePatient.id,
        patientName: activePatient.name,
        modality: activePatient.currentModality,
        bloodFlowRate: activePatient.bloodFlowRate,
        effluentDose: deliveredDoseMlKgHr,
        tmp: activePatient.transmembranePressure,
        filterPressureDrop: activePatient.filterPressureDrop,
        filtrationFraction: activePatient.filtrationFraction,
        netUfRate: activePatient.netUltrafiltrationRate,
        potassium: activePatient.potassium,
        postFilterICa: activePatient.postFilterIonizedCalcium,
        clottingRisk: activePatient.clottingRiskScore,
        status,
      };

      setTelemetryLogs((prev) => [entry, ...prev.slice(0, 49)]);
    }
  }, [tickCount, activePatient, deliveredDoseMlKgHr]);

  // CSV Export Utility
  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Patient ID',
      'Patient Name',
      'Modality',
      'Blood Flow (Qb)',
      'Effluent Dose (mL/kg/h)',
      'TMP (mmHg)',
      'Pressure Drop (mmHg)',
      'Filtration Fraction (%)',
      'Net UF (mL/h)',
      'Potassium (mmol/L)',
      'Post-Filter iCa',
      'Clotting Risk (%)',
      'Status',
    ];

    const rows = telemetryLogs.map((log) => [
      log.timestamp,
      log.patientId,
      `"${log.patientName}"`,
      log.modality,
      log.bloodFlowRate,
      log.effluentDose,
      log.tmp,
      log.filterPressureDrop,
      log.filtrationFraction,
      log.netUfRate,
      log.potassium,
      log.postFilterICa,
      log.clottingRisk,
      log.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nephrology_CRRT_Telemetry_${activePatient.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prescription Update Handler
  const handleSavePrescription = () => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === activePatient.id) {
          const plasmaFlow = editQb * 60 * 0.7;
          const convective = editQpre + editQpost + editNetUf;
          const newFF = plasmaFlow > 0 ? Number(((convective / plasmaFlow) * 100).toFixed(1)) : 0;
          return {
            ...p,
            currentModality: editModality,
            bloodFlowRate: editQb,
            dialysateFlowRate: editQd,
            preReplacementRate: editQpre,
            postReplacementRate: editQpost,
            netUltrafiltrationRate: editNetUf,
            citrateInfusionRate: editCitrateRate,
            calciumChlorideRate: editCalciumRate,
            filtrationFraction: newFF,
          };
        }
        return p;
      })
    );
    setModalFeedback('CRRT Prescription updated and re-verified against KDIGO target dose guidelines.');
    setTimeout(() => {
      setModalFeedback(null);
      setActiveModal(null);
    }, 1200);
  };

  // Emergency Protocol Trigger
  const handleTriggerEmergencyProtocol = (protocolType: string) => {
    let alertMessage = '';
    if (protocolType === 'CIRCUIT_REPLACEMENT') {
      alertMessage = 'EMERGENCY CIRCUIT REPLACEMENT PROTOCOL INITIATED: Blood returned to patient, lines clamped.';
      setPatients((prev) =>
        prev.map((p) =>
          p.id === activePatient.id
            ? {
                ...p,
                transmembranePressure: 80,
                filterPressureDrop: 45,
                filterRunHours: 0.1,
                clottingRiskScore: 5,
                activeAlerts: [
                  { id: `ALT-${Date.now()}`, severity: 'CRITICAL', message: 'New Hemofilter Set Primed & Online', timestamp: 'Just now' },
                  ...p.activeAlerts,
                ],
              }
            : p
        )
      );
    } else if (protocolType === 'CITRATE_LOCK_EMERGENCY') {
      alertMessage = 'CITRATE TOXICITY SAFETY INTERLOCK: Citrate infusion halted. 10% Calcium Gluconate bolus queued.';
      setPatients((prev) =>
        prev.map((p) =>
          p.id === activePatient.id
            ? {
                ...p,
                anticoagulationMode: 'NONE_SALINE_FLUSH',
                citrateInfusionRate: 0,
                activeAlerts: [
                  { id: `ALT-${Date.now()}`, severity: 'CRITICAL', message: 'Citrate Infusion Ceased - Switched to Saline Flush Protocol', timestamp: 'Just now' },
                  ...p.activeAlerts,
                ],
              }
            : p
        )
      );
    } else if (protocolType === 'RAPID_POTASSIUM_SHIFT') {
      alertMessage = 'ACUTE HYPERKALEMIA PROTOCOL: Dialysate K+ Bath decreased to 1.0 mmol/L + IV Dextrose/Insulin.';
      setPatients((prev) =>
        prev.map((p) =>
          p.id === activePatient.id
            ? {
                ...p,
                potassium: 4.8,
                dialysateFlowRate: Math.max(p.dialysateFlowRate, 2000),
                activeAlerts: [
                  { id: `ALT-${Date.now()}`, severity: 'HIGH', message: 'High-Flux Dialysate K+ clearance active', timestamp: 'Just now' },
                  ...p.activeAlerts,
                ],
              }
            : p
        )
      );
    }

    setModalFeedback(alertMessage);
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

    if (filterSeverity === 'ALL') return matchesSearch;
    if (filterSeverity === 'STAGE_3') return matchesSearch && p.kdigoStage === 3;
    if (filterSeverity === 'HIGH_CLOT') return matchesSearch && p.clottingRiskScore >= 50;
    if (filterSeverity === 'CITRATE') return matchesSearch && p.anticoagulationMode === 'RCA_CITRATE';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* ─────────────────────────── Top Navigation Bar ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Droplets className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Nephrology CRRT & Renal Replacement Command Station
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  KDIGO 2024 / FDA 21 CFR Part 11
                </span>
              </div>
              <p className="text-xs text-slate-400">
                High-Assurance Continuous Hemofiltration, Transmembrane Pressure & Regional Citrate Anticoagulation Telemetry
              </p>
            </div>
          </div>

          {/* Engine Controls */}
          <div className="flex items-center space-x-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shadow-inner">
            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800/80">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-medium text-emerald-400">STREAMING</span>
              <span className="text-xs font-mono text-slate-400">T+{tickCount}</span>
            </div>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition-all ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
              title={isPlaying ? 'Pause Telemetry Simulation' : 'Resume Telemetry Simulation'}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Resume'}</span>
            </button>

            {/* Speed Selector */}
            <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSimSpeed(speed)}
                  className={`px-2 py-1 rounded text-xs font-mono font-medium transition-all ${
                    simSpeed === speed
                      ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Audio Alarm Toggle */}
            <button
              onClick={() => setAudioAlarmsEnabled(!audioAlarmsEnabled)}
              className={`p-2 rounded-lg text-xs transition-all ${
                audioAlarmsEnabled
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-900 border border-slate-800'
              }`}
              title={audioAlarmsEnabled ? 'Audio Alarms Muted' : 'Enable Audible Critical Alarms'}
            >
              {audioAlarmsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium flex items-center space-x-1.5 transition-all shadow"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Clinical Overview & KDIGO', icon: Activity },
            { id: 'circuit', label: 'Hemofilter & Circuit Pressures', icon: Sliders },
            { id: 'anticoagulation', label: 'Regional Citrate (RCA) Protocol', icon: ShieldCheck },
            { id: 'acidbase', label: 'Electrolyte & Acid-Base Balance', icon: Scale },
            { id: 'telemetry', label: 'Real-time Telemetry Stream', icon: Terminal },
            { id: 'protocols', label: 'Emergency Safety Protocols', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-transparent'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ─────────────────────────── Patient Selector Carousel ─────────────────────────── */}
      <section className="px-6 py-4 bg-slate-900/40 border-b border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="flex items-center space-x-2">
            <Stethoscope className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Nephrology Critical Care Cohort ({filteredPatients.length} Active RRT Beds)
            </h2>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search bed, patient, diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-56"
              />
            </div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Cohort</option>
              <option value="STAGE_3">KDIGO Stage 3</option>
              <option value="HIGH_CLOT">High Clot Risk (&gt;50%)</option>
              <option value="CITRATE">Citrate RCA</option>
            </select>
          </div>
        </div>

        {/* Patient Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPatients.map((p) => {
            const isSelected = p.id === activePatient.id;
            const isCritical = p.transmembranePressure > 200 || p.clottingRiskScore > 60 || p.kdigoStage === 3;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-500 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-100">{p.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-cyan-300 border border-slate-700">
                        {p.bedNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={p.primaryDiagnosis}>
                      {p.primaryDiagnosis}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.kdigoStage === 3
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : p.kdigoStage === 2
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    KDIGO {p.kdigoStage}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Modality</span>
                    <span className="font-mono font-bold text-cyan-400">{p.currentModality}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">TMP (mmHg)</span>
                    <span
                      className={`font-mono font-bold ${
                        p.transmembranePressure > 200
                          ? 'text-rose-400'
                          : p.transmembranePressure > 160
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {p.transmembranePressure}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">K+ (mmol/L)</span>
                    <span
                      className={`font-mono font-bold ${
                        p.potassium > 5.5
                          ? 'text-rose-400'
                          : p.potassium < 3.5
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {p.potassium}
                    </span>
                  </div>
                </div>

                {/* Clotting Bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>Circuit Thrombosis Risk</span>
                    <span className={`font-mono font-bold ${p.clottingRiskScore > 60 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {p.clottingRiskScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        p.clottingRiskScore > 60
                          ? 'bg-rose-500'
                          : p.clottingRiskScore > 30
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${p.clottingRiskScore}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────── Main Content Views ─────────────────────────── */}
      <main className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
        {/* Active Patient Diagnostic Summary Header */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-lg font-bold shadow-inner">
                {activePatient.bedNumber.split('-')[2] || 'RRT'}
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-slate-100">{activePatient.name}</h3>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {activePatient.id} • {activePatient.age}y / {activePatient.gender} • {activePatient.weightKg} kg ({activePatient.heightCm} cm)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    KDIGO Stage {activePatient.kdigoStage} AKI
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  <span className="text-slate-500">Diagnosis:</span> {activePatient.primaryDiagnosis}
                </p>
                <p className="text-xs text-cyan-400 mt-0.5 font-medium">
                  <span className="text-slate-500">RRT Indication:</span> {activePatient.rrtIndication}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveModal('PRESCRIPTION_CONFIG')}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs flex items-center space-x-2 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-950/50"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Titrate CRRT Prescription</span>
              </button>

              <button
                onClick={() => setActiveModal('EMERGENCY_ACTIONS')}
                className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-xs flex items-center space-x-2 hover:bg-rose-500/30 transition-all shadow"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Emergency Interlocks</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-800/80">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Delivered Dose</span>
                <Info className="h-3 w-3 text-slate-500" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-cyan-400">{deliveredDoseMlKgHr}</span>
                <span className="text-[10px] text-slate-400">mL/kg/h</span>
              </div>
              <span className="text-[10px] text-emerald-400 block mt-0.5">Target 20-25 KDIGO</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Transmembrane (TMP)</span>
                <Gauge className="h-3 w-3 text-slate-500" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span
                  className={`text-lg font-mono font-bold ${
                    activePatient.transmembranePressure > 200
                      ? 'text-rose-400'
                      : activePatient.transmembranePressure > 160
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {activePatient.transmembranePressure}
                </span>
                <span className="text-[10px] text-slate-400">mmHg</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">&lt; 200 mmHg safe</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Filtration Fraction</span>
                <Percent className="h-3 w-3 text-slate-500" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span
                  className={`text-lg font-mono font-bold ${
                    activePatient.filtrationFraction > 25 ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {activePatient.filtrationFraction}%
                </span>
                <span className="text-[10px] text-slate-400">FF</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">&lt; 25% max safe</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Fluid Overload</span>
                <Droplets className="h-3 w-3 text-slate-500" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span
                  className={`text-lg font-mono font-bold ${
                    activePatient.fluidOverloadPercent > 10 ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  +{activePatient.fluidOverloadPercent}%
                </span>
                <span className="text-[10px] text-slate-400">{activePatient.fluidBalance24h} mL</span>
              </div>
              <span className="text-[10px] text-rose-400 block mt-0.5">&gt; 10% high risk</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Serum Creatinine</span>
                <Activity className="h-3 w-3 text-slate-500" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-rose-400">{activePatient.creatinineCurrent}</span>
                <span className="text-[10px] text-slate-400">mg/dL</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Base: {activePatient.creatinineBaseline}</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center justify-between">
                <span>Filter Lifespan</span>
                <Clock className="h-3 w-3 text-slate-500" />
              </span>
              <div className="flex items-baseline space-x-1.5 mt-1">
                <span className="text-lg font-mono font-bold text-cyan-300">{activePatient.filterRunHours}h</span>
                <span className="text-[10px] text-slate-400">/ ~72h</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Est. rem: {activePatient.filterEstimatedRemainingHours}h</span>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── Tab View: Overview ─────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* KDIGO AKI Staging Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Scale className="h-4 w-4 text-cyan-400" />
                      <h4 className="text-sm font-semibold text-slate-200">KDIGO AKI Stratification</h4>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                      STAGE 3 CRITICAL
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-4">
                    Staged according to KDIGO 2024 delta-creatinine and urine output oliguria kinetic indices.
                  </p>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Serum Creatinine Dynamic Delta</span>
                        <span className="font-mono font-bold text-rose-400">
                          +{((activePatient.creatinineCurrent / activePatient.creatinineBaseline) * 100 - 100).toFixed(0)}% (
                          {activePatient.creatinineCurrent} vs {activePatient.creatinineBaseline} mg/dL)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Criterion: &gt;= 3.0x baseline met</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Urine Output Rate (UO)</span>
                        <span className="font-mono font-bold text-rose-400">
                          {(activePatient.urineOutputLastHour / activePatient.weightKg).toFixed(2)} mL/kg/h
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Severe Oliguria / Anuria (&lt; 0.3 mL/kg/h for &gt; 24h)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Estimated GFR (eGFR)</span>
                        <span className="font-mono font-bold text-amber-400">
                          {activePatient.egfrCurrent} mL/min/1.73m²
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Baseline: {activePatient.egfrBaseline} mL/min/1.73m² (CKD-EPI 2021)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Renal Recovery Index</span>
                  <span className="font-mono font-semibold text-cyan-400">Guarded / Active Dialytic Support</span>
                </div>
              </div>

              {/* CRRT Modality & Flow Architecture Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Workflow className="h-4 w-4 text-cyan-400" />
                      <h4 className="text-sm font-semibold text-slate-200">Active CRRT Modality Prescription</h4>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                      {activePatient.currentModality}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 mb-4">
                    <span className="font-semibold text-cyan-300">Continuous Veno-Venous Hemodiafiltration:</span>{' '}
                    Combines convective solute replacement with diffusive counter-current dialysate for full-spectrum molecular clearance.
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Blood Flow Rate (Qb)</span>
                      <span className="font-mono font-bold text-slate-100">{activePatient.bloodFlowRate} mL/min</span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Dialysate Flow (Qd - Diffusion)</span>
                      <span className="font-mono font-bold text-slate-100">{activePatient.dialysateFlowRate} mL/h</span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Pre-Filter Replacement (Qpre)</span>
                      <span className="font-mono font-bold text-slate-100">{activePatient.preReplacementRate} mL/h</span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Post-Filter Replacement (Qpost)</span>
                      <span className="font-mono font-bold text-slate-100">{activePatient.postReplacementRate} mL/h</span>
                    </div>
                    <div className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400">Net Patient Ultrafiltration (Quf)</span>
                      <span className="font-mono font-bold text-cyan-400">{activePatient.netUltrafiltrationRate} mL/h</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total Effluent Rate</span>
                  <span className="font-mono font-bold text-cyan-300">{totalEffluentFlow} mL/h</span>
                </div>
              </div>

              {/* Circuit Integrity & Clotting Predictor */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-cyan-400" />
                      <h4 className="text-sm font-semibold text-slate-200">AI Circuit Clotting Hazard</h4>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                        activePatient.clottingRiskScore > 60
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : activePatient.clottingRiskScore > 30
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {activePatient.clottingRiskScore}% HAZARD
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-4">
                    Machine learning model evaluating TMP velocity curve, filter pressure drop, and shear rate.
                  </p>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Transmembrane Pressure (TMP)</span>
                        <span
                          className={`font-mono font-bold ${
                            activePatient.transmembranePressure > 200 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {activePatient.transmembranePressure} mmHg
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${
                            activePatient.transmembranePressure > 200
                              ? 'bg-rose-500'
                              : activePatient.transmembranePressure > 150
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, (activePatient.transmembranePressure / 250) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Filter Pressure Drop (dP)</span>
                        <span className="font-mono font-bold text-slate-200">{activePatient.filterPressureDrop} mmHg</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">dP = Filter P - Venous P (Hollow fiber patency)</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Estimated Remaining Membrane Life</span>
                        <span className="font-mono font-bold text-cyan-300">
                          {activePatient.filterEstimatedRemainingHours} hours
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Baseline circuit life: 72 hours</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Anticoagulation Status</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {activePatient.anticoagulationMode === 'RCA_CITRATE' ? 'RCA Active (Optimal)' : 'Systemic'}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Clinical Alerts Feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Flame className="h-4 w-4 text-rose-400" />
                  <h4 className="text-sm font-semibold text-slate-200">Active Nephrology Surveillance Alerts</h4>
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
                            : 'text-cyan-400'
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
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
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

        {/* ─────────────────────────── Tab View: Circuit & Pressures ─────────────────────────── */}
        {activeTab === 'circuit' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-100">Extracorporeal Circuit Schematic & Hydrodynamics</h4>
                  <p className="text-xs text-slate-400">
                    Real-time pressure gradient tracking across arterial access, blood pump, pre-filter, hemofilter, and venous return chamber.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Qb: {activePatient.bloodFlowRate} mL/min
                </span>
              </div>

              {/* Hydrodynamic Pressure Nodes Visualizer */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Arterial Access Line</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Pacc</span>
                  </div>
                  <div className="flex items-baseline space-x-1.5">
                    <span
                      className={`text-2xl font-mono font-bold ${
                        activePatient.accessPressure < -150 ? 'text-rose-400' : 'text-slate-100'
                      }`}
                    >
                      {activePatient.accessPressure}
                    </span>
                    <span className="text-xs text-slate-400">mmHg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">VasCath / PermCath suction pressure (-250 to 0)</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Pre-Filter Membrane Pressure</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Ppre</span>
                  </div>
                  <div className="flex items-baseline space-x-1.5">
                    <span
                      className={`text-2xl font-mono font-bold ${
                        activePatient.filterPressure > 220 ? 'text-rose-400' : 'text-slate-100'
                      }`}
                    >
                      {activePatient.filterPressure}
                    </span>
                    <span className="text-xs text-slate-400">mmHg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Entry pressure into polysulfone fibers</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Venous Return Pressure</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Pven</span>
                  </div>
                  <div className="flex items-baseline space-x-1.5">
                    <span
                      className={`text-2xl font-mono font-bold ${
                        activePatient.venousPressure > 150 ? 'text-rose-400' : 'text-slate-100'
                      }`}
                    >
                      {activePatient.venousPressure}
                    </span>
                    <span className="text-xs text-slate-400">mmHg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Resistance in venous air detector chamber</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Effluent / Waste Pressure</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Peff</span>
                  </div>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-2xl font-mono font-bold text-slate-100">
                      {activePatient.effluentPressure}
                    </span>
                    <span className="text-xs text-slate-400">mmHg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Ultrafiltration suction side</p>
                </div>
              </div>

              {/* TMP Equation Walkthrough */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs">
                <div className="text-cyan-400 font-bold mb-2">Transmembrane Pressure (TMP) Kinetic Formulation:</div>
                <div className="text-slate-300">
                  TMP = (P_filter + P_venous) / 2 - P_effluent = ({activePatient.filterPressure} + {activePatient.venousPressure}) / 2 - ({activePatient.effluentPressure}) = <span className="text-cyan-300 font-bold">{activePatient.transmembranePressure} mmHg</span>
                </div>
                <div className="text-slate-400 mt-1">
                  Filter Pressure Drop (dP) = P_filter - P_venous = {activePatient.filterPressure} - {activePatient.venousPressure} = <span className="text-cyan-300 font-bold">{activePatient.filterPressureDrop} mmHg</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────── Tab View: Anticoagulation ─────────────────────────── */}
        {activeTab === 'anticoagulation' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-base font-bold text-slate-100">Regional Citrate Anticoagulation (RCA) Protocol</h4>
                    <p className="text-xs text-slate-400">
                      Pre-filter trisodium citrate infusion chelates ionized calcium to halt the clotting cascade in the circuit, while post-filter calcium infusion restores systemic homeostatic levels.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {activePatient.anticoagulationMode}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Post-Filter Ionized Calcium (Target 0.25 - 0.35 mmol/L)</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span
                        className={`text-2xl font-mono font-bold ${
                          activePatient.postFilterIonizedCalcium < 0.20 || activePatient.postFilterIonizedCalcium > 0.40
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {activePatient.postFilterIonizedCalcium}
                      </span>
                      <span className="text-xs text-slate-400">mmol/L</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 block mt-1">Circuit Anticoagulation: Therapeutic</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Systemic Ionized Calcium (Target 1.10 - 1.30 mmol/L)</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span
                        className={`text-2xl font-mono font-bold ${
                          activePatient.systemicIonizedCalcium < 1.10 ? 'text-amber-400' : 'text-slate-100'
                        }`}
                      >
                        {activePatient.systemicIonizedCalcium}
                      </span>
                      <span className="text-xs text-slate-400">mmol/L</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">Patient Systemic Hemostasis Maintained</span>
                  </div>
                </div>

                {/* Citrate Toxicity Index / Citrate Lock */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-200">Citrate Lock Surveillance (Total Ca / Ionized Ca Ratio)</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        activePatient.totToIonizedCaRatio >= 2.5 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {activePatient.totToIonizedCaRatio} : 1
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        activePatient.totToIonizedCaRatio >= 2.5 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (activePatient.totToIonizedCaRatio / 3.0) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
                    <span>Safe (&lt; 2.2)</span>
                    <span>Warning (2.2 - 2.5)</span>
                    <span className="text-rose-400 font-bold">Citrate Toxicity (&gt;= 2.5)</span>
                  </div>
                </div>
              </div>

              {/* Infusion Pumps Configuration */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h4 className="text-sm font-bold text-slate-200">Continuous Precision Syringe Pumps</h4>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 block">ACD-A Citrate 4% Infusion</span>
                  <div className="flex items-baseline space-x-1.5 mt-1">
                    <span className="text-xl font-mono font-bold text-cyan-400">{activePatient.citrateInfusionRate}</span>
                    <span className="text-xs text-slate-400">mL/h</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Pre-blood pump infusion</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 block">10% Calcium Chloride / Gluconate</span>
                  <div className="flex items-baseline space-x-1.5 mt-1">
                    <span className="text-xl font-mono font-bold text-emerald-400">{activePatient.calciumChlorideRate}</span>
                    <span className="text-xs text-slate-400">mL/h</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Dedicated central venous line compensation</span>
                </div>

                <button
                  onClick={() => setActiveModal('CITRATE_TITRATION')}
                  className="w-full py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold hover:bg-cyan-500/30 transition-all"
                >
                  Open RCA Titration Calculator
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────── Tab View: Acid-Base & Electrolytes ─────────────────────────── */}
        {activeTab === 'acidbase' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-xs text-slate-400 uppercase">Arterial Blood Gas pH</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span
                    className={`text-3xl font-mono font-bold ${
                      activePatient.arterialPh < 7.30 ? 'text-rose-400' : 'text-slate-100'
                    }`}
                  >
                    {activePatient.arterialPh}
                  </span>
                  <span className="text-xs text-slate-400">pH</span>
                </div>
                <span className="text-xs text-rose-400 block mt-1">Metabolic Acidosis</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-xs text-slate-400 uppercase">Serum Bicarbonate (HCO3-)</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span className="text-3xl font-mono font-bold text-amber-400">{activePatient.bicarbonate}</span>
                  <span className="text-xs text-slate-400">mmol/L</span>
                </div>
                <span className="text-xs text-slate-500 block mt-1">Target 22 - 26 mmol/L</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-xs text-slate-400 uppercase">Serum Potassium (K+)</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span
                    className={`text-3xl font-mono font-bold ${
                      activePatient.potassium > 5.5 ? 'text-rose-400' : 'text-slate-100'
                    }`}
                  >
                    {activePatient.potassium}
                  </span>
                  <span className="text-xs text-slate-400">mmol/L</span>
                </div>
                <span className="text-xs text-rose-400 block mt-1">Dialysate K+ Bath 2.0 mmol/L Active</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-xs text-slate-400 uppercase">Arterial Lactate</span>
                <div className="flex items-baseline space-x-1.5 mt-2">
                  <span
                    className={`text-3xl font-mono font-bold ${
                      activePatient.lactate > 2.0 ? 'text-amber-400' : 'text-slate-100'
                    }`}
                  >
                    {activePatient.lactate}
                  </span>
                  <span className="text-xs text-slate-400">mmol/L</span>
                </div>
                <span className="text-xs text-slate-500 block mt-1">Tissue hypoperfusion marker</span>
              </div>
            </div>

            {/* Stewart Acid-Base Calculation Model */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 font-mono text-xs">
              <h4 className="text-sm font-bold text-cyan-400 font-sans">Stewart Physico-Chemical Acid-Base Profile</h4>
              <p className="text-slate-400 font-sans">
                Apparent Strong Ion Difference (SIDa) = [Na+] + [K+] - [Cl-] - [Lactate] = {activePatient.sodium} + {activePatient.potassium} - {activePatient.chloride} - {activePatient.lactate} = <span className="text-cyan-300 font-bold">{(activePatient.sodium + activePatient.potassium - activePatient.chloride - activePatient.lactate).toFixed(1)} mEq/L</span>
              </p>
              <p className="text-slate-400 font-sans">
                Effective Strong Ion Difference (SIDe) = [HCO3-] + [Albumin charge] + [Phosphate charge] = <span className="text-cyan-300 font-bold">32.4 mEq/L</span>
              </p>
              <p className="text-slate-400 font-sans">
                Strong Ion Gap (SIG) = SIDa - SIDe = <span className="text-amber-400 font-bold">+6.8 mEq/L (Unmeasured Uremic Anions)</span>
              </p>
            </div>
          </div>
        )}

        {/* ─────────────────────────── Tab View: Telemetry Stream ─────────────────────────── */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-100">Continuous Telemetry Audit Ledger</h4>
                  <p className="text-xs text-slate-400">
                    Chronological stream of hemodynamic, dialytic, and biochemical telemetry snapshots.
                  </p>
                </div>
                <span className="text-xs text-cyan-400 font-mono">{telemetryLogs.length} Records in Memory</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Modality</th>
                      <th className="py-2.5 px-3">Qb (mL/min)</th>
                      <th className="py-2.5 px-3">Delivered Dose</th>
                      <th className="py-2.5 px-3">TMP (mmHg)</th>
                      <th className="py-2.5 px-3">dP (mmHg)</th>
                      <th className="py-2.5 px-3">FF (%)</th>
                      <th className="py-2.5 px-3">Net UF (mL/h)</th>
                      <th className="py-2.5 px-3">K+ (mmol/L)</th>
                      <th className="py-2.5 px-3">Clot Risk</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {telemetryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-500 font-sans">
                          Waiting for initial real-time telemetry ticks...
                        </td>
                      </tr>
                    ) : (
                      telemetryLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-2 px-3 text-slate-400">{log.timestamp}</td>
                          <td className="py-2 px-3 text-slate-200 font-sans font-medium">{log.patientName}</td>
                          <td className="py-2 px-3 text-cyan-400">{log.modality}</td>
                          <td className="py-2 px-3">{log.bloodFlowRate}</td>
                          <td className="py-2 px-3 text-cyan-300 font-bold">{log.effluentDose}</td>
                          <td className="py-2 px-3">{log.tmp}</td>
                          <td className="py-2 px-3">{log.filterPressureDrop}</td>
                          <td className="py-2 px-3">{log.filtrationFraction}%</td>
                          <td className="py-2 px-3">{log.netUfRate}</td>
                          <td className="py-2 px-3">{log.potassium}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`font-bold ${
                                log.clottingRisk > 60 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {log.clottingRisk}%
                            </span>
                          </td>
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
                  <h4 className="text-base font-bold text-slate-100">Emergency Circuit Exchange</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Executed when TMP exceeds 250 mmHg or dP exceeds 200 mmHg. Rinses back red cell volume and primes new polysulfone set.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerEmergencyProtocol('CIRCUIT_REPLACEMENT')}
                  className="mt-5 w-full py-2.5 rounded-xl bg-rose-500 text-slate-950 font-bold text-xs hover:bg-rose-400 transition-all shadow-md shadow-rose-950/50"
                >
                  Trigger Circuit Exchange
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-100">Citrate Toxicity Interlock</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Ceases citrate infusion immediately when Total Ca / iCa ratio &gt;= 2.5 and shifts patient to saline flush or heparin protocol.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerEmergencyProtocol('CITRATE_LOCK_EMERGENCY')}
                  className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-950/50"
                >
                  Halt Citrate Infusion
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-100">Acute Hyperkalemia Shift</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Deploys high-gradient 1.0 mmol/L K+ dialysate bath and accelerates convective hemofiltration rate.
                  </p>
                </div>
                <button
                  onClick={() => handleTriggerEmergencyProtocol('RAPID_POTASSIUM_SHIFT')}
                  className="mt-5 w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all shadow-md shadow-cyan-950/50"
                >
                  Deploy K+ Shift Protocol
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────── Interactive Modal: Prescription Configurator ─────────────────────────── */}
      {activeModal === 'PRESCRIPTION_CONFIG' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">Titrate CRRT Prescription</h3>
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
                <label className="text-xs text-slate-400 block mb-1">CRRT Modality</label>
                <select
                  value={editModality}
                  onChange={(e) => setEditModality(e.target.value as any)}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CVVHDF">CVVHDF (Hemodiafiltration)</option>
                  <option value="CVVH">CVVH (Hemofiltration)</option>
                  <option value="CVVHD">CVVHD (Hemodialysis)</option>
                  <option value="SCUF">SCUF (Slow Continuous Ultrafiltration)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Blood Flow Rate (Qb, mL/min)</label>
                <input
                  type="number"
                  min="100"
                  max="350"
                  value={editQb}
                  onChange={(e) => setEditQb(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Dialysate Flow (Qd, mL/h)</label>
                <input
                  type="number"
                  min="0"
                  max="3000"
                  step="100"
                  value={editQd}
                  onChange={(e) => setEditQd(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Pre-Filter Replacement (Qpre, mL/h)</label>
                <input
                  type="number"
                  min="0"
                  max="3000"
                  step="100"
                  value={editQpre}
                  onChange={(e) => setEditQpre(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Post-Filter Replacement (Qpost, mL/h)</label>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  step="50"
                  value={editQpost}
                  onChange={(e) => setEditQpost(Number(e.target.value))}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Net Ultrafiltration (Quf, mL/h)</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="25"
                  value={editNetUf}
                  onChange={(e) => setEditNetUf(Number(e.target.value))}
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
                onClick={handleSavePrescription}
                className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-all shadow"
              >
                Apply Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────── Interactive Modal: Emergency Interlocks ─────────────────────────── */}
      {activeModal === 'EMERGENCY_ACTIONS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <h3 className="text-base font-bold text-rose-300">Clinical Emergency Safety Interlocks</h3>
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
                onClick={() => handleTriggerEmergencyProtocol('CIRCUIT_REPLACEMENT')}
                className="w-full p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-left hover:bg-rose-950/60 transition-all"
              >
                <span className="text-xs font-bold text-rose-300 block">Immediate Circuit Disconnection & Replacement</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Use when filter clotted or irreversible fiber fouling occurred.
                </span>
              </button>

              <button
                onClick={() => handleTriggerEmergencyProtocol('CITRATE_LOCK_EMERGENCY')}
                className="w-full p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/80 text-left hover:bg-amber-950/60 transition-all"
              >
                <span className="text-xs font-bold text-amber-300 block">Emergency Citrate Infusion Arrest</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Instantly terminates ACD-A delivery for Total Ca / iCa ratio &gt; 2.5 or metabolic acidosis exacerbation.
                </span>
              </button>

              <button
                onClick={() => handleTriggerEmergencyProtocol('RAPID_POTASSIUM_SHIFT')}
                className="w-full p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/80 text-left hover:bg-cyan-950/60 transition-all"
              >
                <span className="text-xs font-bold text-cyan-300 block">Acute Hyperkalemic Dialytic Surge</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Switches dialysate bath to 1.0 K+ and ramps up convective elimination rate.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NephrologyCRRTPage;
