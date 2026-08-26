import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeAlert,
  Beaker,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Download,
  Droplet,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  HeartPulse,
  HelpCircle,
  Layers,
  Microscope,
  Pause,
  Pill,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Timer,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Waves,
  Zap,
} from 'lucide-react';

interface PatientVitalHistory {
  time: string;
  map: number;
  heartRate: number;
  lactate: number;
  respRate: number;
  spo2: number;
  temp: number;
  neDose: number;
}

interface SepsisPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: string;
  location: string;
  diagnosis: string;
  source: string;
  severity: 'SIRS' | 'SEPSIS' | 'SEPTIC_SHOCK' | 'REFRACTORY_SHOCK';
  sofaScore: number;
  qsofaScore: number;
  fluidGivenMl: number;
  fluidTargetMl: number;
  lactateInitial: number;
  lactateCurrent: number;
  procalcitonin: number;
  map: number;
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  respRate: number;
  tempC: number;
  spo2: number;
  pao2: number;
  fio2: number;
  platelets: number;
  bilirubin: number;
  creatinine: number;
  gcs: number;
  urineOutputMlHr: number;
  vasopressor: {
    primary: string;
    neRate: number; // mcg/kg/min
    secondary: string;
    vasoUnits: number; // units/min
    tertiary?: string;
    epiRate?: number;
    visScore: number;
  };
  antimicrobials: Array<{
    drug: string;
    regimen: string;
    measuredTrough: number;
    targetTrough: string;
    estimatedAuc24: number;
    targetAuc24: string;
    mic: number;
    status: 'OPTIMAL' | 'SUBTHERAPEUTIC' | 'TOXIC_RISK' | 'PENDING';
  }>;
  microbiology: {
    bloodCultureStatus: string;
    organism: string;
    antibiogramSusceptible: string[];
    antibiogramResistant: string[];
    pcrMarker: string;
  };
  sscBundle: {
    lactateInitial: boolean;
    bloodCultures: boolean;
    broadAntibiotics: boolean;
    fluidBolus: boolean;
    vasopressors: boolean;
    lactateRepeat: boolean;
  };
  bundleElapsedMinutes: number;
}

const SEPSIS_PATIENTS_DATABASE: SepsisPatient[] = [
  {
    id: 'SEP-8801',
    mrn: 'MED-908123',
    name: 'Elena Rostova',
    ageYears: 64,
    sex: 'Female',
    location: 'Medical ICU - Bed 04',
    diagnosis: 'Severe Urosepsis & Septic Shock with Refractory Hypotension',
    source: 'Urinary Tract (Indwelling Foley Catheter)',
    severity: 'SEPTIC_SHOCK',
    sofaScore: 9,
    qsofaScore: 3,
    fluidGivenMl: 2200,
    fluidTargetMl: 2100,
    lactateInitial: 4.8,
    lactateCurrent: 2.9,
    procalcitonin: 18.4,
    map: 67,
    systolicBp: 94,
    diastolicBp: 53,
    heartRate: 118,
    respRate: 26,
    tempC: 38.9,
    spo2: 94,
    pao2: 82,
    fio2: 0.45,
    platelets: 98,
    bilirubin: 2.3,
    creatinine: 2.8,
    gcs: 12,
    urineOutputMlHr: 22,
    vasopressor: {
      primary: 'Norepinephrine',
      neRate: 0.18,
      secondary: 'Vasopressin',
      vasoUnits: 0.03,
      visScore: 21.0,
    },
    antimicrobials: [
      {
        drug: 'Meropenem',
        regimen: '2g IV q8h (4h Extended Infusion)',
        measuredTrough: 14.2,
        targetTrough: '8 - 16 mcg/mL',
        estimatedAuc24: 405,
        targetAuc24: '100% fT > 4x MIC',
        mic: 0.5,
        status: 'OPTIMAL',
      },
      {
        drug: 'Vancomycin',
        regimen: '1500mg Loading, then 1000mg q12h',
        measuredTrough: 18.5,
        targetTrough: '15 - 20 mcg/mL',
        estimatedAuc24: 520,
        targetAuc24: '400 - 600 mg*h/L',
        mic: 1.0,
        status: 'OPTIMAL',
      },
    ],
    microbiology: {
      bloodCultureStatus: 'Positive (12h): Gram-negative bacilli',
      organism: 'Klebsiella pneumoniae (CTX-M ESBL producer)',
      antibiogramSusceptible: ['Meropenem', 'Ertapenem', 'Amikacin', 'Ceftazidime-Avibactam'],
      antibiogramResistant: ['Ceftriaxone', 'Cefepime', 'Ciprofloxacin', 'Ampicillin-Sulbactam'],
      pcrMarker: 'blaCTX-M-15 Positive',
    },
    sscBundle: {
      lactateInitial: true,
      bloodCultures: true,
      broadAntibiotics: true,
      fluidBolus: true,
      vasopressors: true,
      lactateRepeat: true,
    },
    bundleElapsedMinutes: 48,
  },
  {
    id: 'SEP-8802',
    mrn: 'MED-745210',
    name: 'Marcus Vance',
    ageYears: 52,
    sex: 'Male',
    location: 'Trauma-Surgical ICU - Bed 09',
    diagnosis: 'Post-Operative Peritonitis & Polymicrobial Septic Shock',
    source: 'Intra-abdominal (Anastomotic Leak Post-Colectomy)',
    severity: 'REFRACTORY_SHOCK',
    sofaScore: 13,
    qsofaScore: 3,
    fluidGivenMl: 3200,
    fluidTargetMl: 2550,
    lactateInitial: 6.5,
    lactateCurrent: 4.8,
    procalcitonin: 34.2,
    map: 61,
    systolicBp: 86,
    diastolicBp: 48,
    heartRate: 134,
    respRate: 30,
    tempC: 39.4,
    spo2: 91,
    pao2: 74,
    fio2: 0.60,
    platelets: 62,
    bilirubin: 3.9,
    creatinine: 3.6,
    gcs: 10,
    urineOutputMlHr: 14,
    vasopressor: {
      primary: 'Norepinephrine',
      neRate: 0.34,
      secondary: 'Vasopressin',
      vasoUnits: 0.03,
      tertiary: 'Epinephrine',
      epiRate: 0.08,
      visScore: 50.0,
    },
    antimicrobials: [
      {
        drug: 'Meropenem',
        regimen: '2g IV q8h Continuous Infusion',
        measuredTrough: 17.5,
        targetTrough: '8 - 16 mcg/mL',
        estimatedAuc24: 420,
        targetAuc24: '100% fT > 4x MIC',
        mic: 2.0,
        status: 'OPTIMAL',
      },
      {
        drug: 'Colistin',
        regimen: '300mg CBA Loading, then 150mg q12h',
        measuredTrough: 2.9,
        targetTrough: '2 - 3.5 mcg/mL',
        estimatedAuc24: 60,
        targetAuc24: '>= 50 mg*h/L',
        mic: 1.0,
        status: 'OPTIMAL',
      },
    ],
    microbiology: {
      bloodCultureStatus: 'Positive (8h): Gram-negative rods & Gram-positive cocci',
      organism: 'Pseudomonas aeruginosa (MDR) + Enterococcus faecium',
      antibiogramSusceptible: ['Colistin', 'Ceftolozane-Tazobactam', 'Meropenem (high-dose CI)', 'Daptomycin'],
      antibiogramResistant: ['Piperacillin-Tazobactam', 'Cefepime', 'Gentamicin', 'Vancomycin'],
      pcrMarker: 'VIM Carbapenemase Negative',
    },
    sscBundle: {
      lactateInitial: true,
      bloodCultures: true,
      broadAntibiotics: true,
      fluidBolus: true,
      vasopressors: true,
      lactateRepeat: true,
    },
    bundleElapsedMinutes: 72,
  },
  {
    id: 'SEP-8803',
    mrn: 'MED-612984',
    name: 'Gwendolyn Clark',
    ageYears: 71,
    sex: 'Female',
    location: 'Emergency Department - Bay 02',
    diagnosis: 'Severe Community-Acquired Pneumonia with Sepsis',
    source: 'Pulmonary (Left Lower Lobe Lobar Consolidation)',
    severity: 'SEPSIS',
    sofaScore: 5,
    qsofaScore: 2,
    fluidGivenMl: 1600,
    fluidTargetMl: 1800,
    lactateInitial: 3.6,
    lactateCurrent: 2.2,
    procalcitonin: 9.1,
    map: 74,
    systolicBp: 106,
    diastolicBp: 58,
    heartRate: 104,
    respRate: 24,
    tempC: 38.7,
    spo2: 93,
    pao2: 86,
    fio2: 0.35,
    platelets: 168,
    bilirubin: 0.9,
    creatinine: 1.6,
    gcs: 14,
    urineOutputMlHr: 42,
    vasopressor: {
      primary: 'None (Fluid Responsive)',
      neRate: 0.0,
      secondary: 'None',
      vasoUnits: 0.0,
      visScore: 0.0,
    },
    antimicrobials: [
      {
        drug: 'Ceftriaxone',
        regimen: '2g IV q24h',
        measuredTrough: 24.0,
        targetTrough: '10 - 30 mcg/mL',
        estimatedAuc24: 680,
        targetAuc24: '>= 50% fT > MIC',
        mic: 0.5,
        status: 'OPTIMAL',
      },
      {
        drug: 'Azithromycin',
        regimen: '500mg IV q24h',
        measuredTrough: 0.85,
        targetTrough: '0.4 - 1.0 mcg/mL',
        estimatedAuc24: 18,
        targetAuc24: 'AUC24/MIC > 25',
        mic: 0.12,
        status: 'OPTIMAL',
      },
    ],
    microbiology: {
      bloodCultureStatus: 'Pending (Lancet Gram-positive diplococci)',
      organism: 'Streptococcus pneumoniae (Pneumococcal Sepsis)',
      antibiogramSusceptible: ['Ceftriaxone', 'Penicillin G', 'Levofloxacin', 'Vancomycin'],
      antibiogramResistant: ['Erythromycin', 'Clindamycin'],
      pcrMarker: 'Urine Pneumococcal Antigen (+)',
    },
    sscBundle: {
      lactateInitial: true,
      bloodCultures: true,
      broadAntibiotics: true,
      fluidBolus: true,
      vasopressors: false,
      lactateRepeat: true,
    },
    bundleElapsedMinutes: 34,
  },
];

export default function SepsisAntimicrobialStewardshipPage() {
  const [patients, setPatients] = useState<SepsisPatient[]>(SEPSIS_PATIENTS_DATABASE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('SEP-8801');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'SSC_BUNDLE' | 'SOFA_ORGAN' | 'PK_PD_STEWARDSHIP' | 'PROTOCOLS'>('TELEMETRY');

  // Protocol Modal State
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [selectedProtocolToTrigger, setSelectedProtocolToTrigger] = useState<string>('CODE_SEPSIS');
  const [clinicianId, setClinicianId] = useState<string>('MD-ICU-4918 (Dr. Sarah Chen)');
  const [activationRationale, setActivationRationale] = useState<string>('Refractory vasodilatory hypotension meeting Sepsis-3 shock criteria despite 30 mL/kg fluid challenge.');
  const [signatureLogs, setSignatureLogs] = useState<Array<{ id: string; time: string; signer: string; protocol: string; hash: string }>>([
    {
      id: 'SIG-901',
      time: new Date(Date.now() - 1000 * 60 * 25).toLocaleTimeString(),
      signer: 'Dr. Sarah Chen (MD-ICU-4918)',
      protocol: 'Surviving Sepsis 1-Hour Bundle Activation',
      hash: 'e8f3a90c1284bb41e9742fa910d65b7194c2510f92b74c0b62e49c71629fa812',
    },
  ]);

  // Selected Patient
  const patient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Lactate Kinetics calculation
  const lactateClearancePct = useMemo(() => {
    if (!patient.lactateInitial || patient.lactateInitial <= 0) return 0;
    const diff = patient.lactateInitial - patient.lactateCurrent;
    return Math.round((diff / patient.lactateInitial) * 1000) / 10;
  }, [patient.lactateInitial, patient.lactateCurrent]);

  // Norepinephrine Equivalent Dose (NED)
  const nedMcgKgMin = useMemo(() => {
    const ne = patient.vasopressor.neRate;
    const epi = patient.vasopressor.epiRate || 0;
    const vasoEq = (patient.vasopressor.vasoUnits || 0) * 8.33;
    return Math.round((ne + epi + vasoEq) * 100) / 100;
  }, [patient.vasopressor]);

  // Vital history stream buffer
  const [vitalStream, setVitalStream] = useState<PatientVitalHistory[]>(() => {
    const list: PatientVitalHistory[] = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      list.push({
        time: new Date(now - i * 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        map: 65 + Math.sin(i) * 4,
        heartRate: 115 + Math.cos(i) * 6,
        lactate: 4.2 - i * 0.12,
        respRate: 26 + Math.sin(i * 2) * 2,
        spo2: 94,
        temp: 38.8,
        neDose: 0.18,
      });
    }
    return list;
  });

  // Telemetry real-time tick engine
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setTickCount((prev) => prev + 1);

      setPatients((prevList) =>
        prevList.map((p) => {
          if (p.id !== selectedPatientId) return p;

          // Introduce physiological fluctuations
          const mapFluctuation = (Math.random() - 0.48) * 1.5;
          const hrFluctuation = (Math.random() - 0.5) * 2.0;
          const newMap = Math.max(50, Math.min(105, Math.round((p.map + mapFluctuation) * 10) / 10));
          const newHr = Math.max(60, Math.min(160, Math.round(p.heartRate + hrFluctuation)));

          // Serial lactate gradual clearance or kinetics
          const lactateTrend = p.severity === 'REFRACTORY_SHOCK' ? 0.01 : -0.01;
          const newLactate = Math.max(1.0, Math.round((p.lactateCurrent + lactateTrend) * 100) / 100);

          return {
            ...p,
            map: newMap,
            heartRate: newHr,
            lactateCurrent: newLactate,
            systolicBp: Math.round(newMap * 1.25 + (Math.random() * 4 - 2)),
            diastolicBp: Math.round(newMap * 0.75 + (Math.random() * 3 - 1.5)),
          };
        }),
      );

      // Append vital snapshot
      setVitalStream((prev) => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newSnapshot: PatientVitalHistory = {
          time: nextTime,
          map: patient.map,
          heartRate: patient.heartRate,
          lactate: patient.lactateCurrent,
          respRate: patient.respRate,
          spo2: patient.spo2,
          temp: patient.tempC,
          neDose: patient.vasopressor.neRate,
        };
        return [...prev.slice(1), newSnapshot];
      });
    }, 1500 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed, selectedPatientId, patient]);

  // Trigger Protocol Handler
  const handleActivateEmergencyProtocol = useCallback(() => {
    const timestamp = new Date().toISOString();
    const newHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const newLog = {
      id: `SIG-${Math.floor(1000 + Math.random() * 9000)}`,
      time: new Date().toLocaleTimeString(),
      signer: clinicianId,
      protocol: selectedProtocolToTrigger,
      hash: newHash,
    };

    setSignatureLogs((prev) => [newLog, ...prev]);

    // Update patient active protocol state
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === selectedPatientId) {
          return {
            ...p,
            severity: selectedProtocolToTrigger === 'REFRACTORY_SEPTIC_SHOCK' ? 'REFRACTORY_SHOCK' : p.severity,
          };
        }
        return p;
      }),
    );

    setIsProtocolModalOpen(false);
  }, [clinicianId, selectedProtocolToTrigger, selectedPatientId]);

  // Export FHIR R4 Bundle
  const handleExportFhirBundle = useCallback(() => {
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      identifier: { system: 'https://medtrack.hospital.org/fhir/sepsis', value: `SEP-FHIR-${patient.id}-${Date.now()}` },
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: patient.id,
            identifier: [{ system: 'urn:mrn', value: patient.mrn }],
            name: [{ text: patient.name }],
            gender: patient.sex.toLowerCase(),
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-sofa-${patient.id}`,
            code: { text: 'SOFA Organ Dysfunction Score' },
            valueInteger: patient.sofaScore,
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-lactate-${patient.id}`,
            code: { text: 'Blood Lactate Concentration' },
            valueQuantity: { value: patient.lactateCurrent, unit: 'mmol/L' },
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-ssc-${patient.id}`,
            title: 'Surviving Sepsis Campaign 1-Hour Care Bundle',
            activity: patient.antimicrobials.map((abx) => ({
              detail: { code: { text: `${abx.drug} ${abx.regimen}` }, status: 'in-progress' },
            })),
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR_R4_Sepsis_Bundle_${patient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patient]);

  // Export CSV Report
  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Patient ID', 'MRN', 'Name', 'Severity', 'SOFA Score', 'qSOFA', 'MAP (mmHg)', 'Heart Rate', 'Lactate Initial', 'Lactate Current', 'Lactate Clearance %', 'Procalcitonin', 'Norepinephrine Dose', 'Organism', 'Bundle Compliance'],
      [
        patient.id,
        patient.mrn,
        patient.name,
        patient.severity,
        patient.sofaScore,
        patient.qsofaScore,
        patient.map,
        patient.heartRate,
        patient.lactateInitial,
        patient.lactateCurrent,
        `${lactateClearancePct}%`,
        patient.procalcitonin,
        `${patient.vasopressor.neRate} mcg/kg/min`,
        patient.microbiology.organism,
        '100% Compliant',
      ],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sepsis_Resuscitation_Audit_${patient.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patient, lactateClearancePct]);

  // Severity color badge helper
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'REFRACTORY_SHOCK':
        return 'bg-purple-950/80 border-purple-500/80 text-purple-300 animate-pulse';
      case 'SEPTIC_SHOCK':
        return 'bg-rose-950/80 border-rose-500/80 text-rose-300';
      case 'SEPSIS':
        return 'bg-amber-950/80 border-amber-500/80 text-amber-300';
      default:
        return 'bg-blue-950/80 border-blue-500/80 text-blue-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-rose-500 selection:text-white">
      {/* Top Navigation & Status Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-600 to-amber-600 shadow-lg shadow-rose-950/50 flex items-center justify-center ring-2 ring-rose-400/30">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MEDTRACK SEPSIS COMMAND STATION
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-widest">
                    SSC 2026 Resuscitation Engine
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Surviving Sepsis Campaign 1-Hour Care Bundle &bull; Sepsis-3 Organ Dysfunction &bull; Antimicrobial Stewardship AI &bull; FDA 21 CFR Part 11
              </p>
            </div>
          </div>

          {/* Engine Controls & Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Simulation controls */}
            <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-1 space-x-1">
              <button
                onClick={() => setIsSimulating(!isSimulating)}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  isSimulating ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isSimulating ? <Play className="w-3.5 h-3.5 fill-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                {isSimulating ? 'LIVE TICKING' : 'PAUSED'}
              </button>
              <div className="flex items-center space-x-0.5 text-xs">
                {[1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setSimulationSpeed(speed)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      simulationSpeed === speed ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Emergency Protocol Trigger Button */}
            <button
              onClick={() => setIsProtocolModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg shadow-rose-950/50 border border-rose-400/30 transition-all transform active:scale-95"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              EMERGENCY PROTOCOL
            </button>

            {/* Export Actions */}
            <button
              onClick={handleExportFhirBundle}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
              FHIR R4
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              CSV
            </button>
          </div>
        </div>

        {/* Patient Selection Ribbon */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-rose-400" /> Critical Care Cohort:
            </span>
            <div className="flex items-center space-x-2">
              {patients.map((p) => {
                const isSelected = p.id === selectedPatientId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-2 border transition-all ${
                      isSelected
                        ? 'bg-rose-950/60 border-rose-500 text-white shadow-md shadow-rose-950/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${p.severity === 'REFRACTORY_SHOCK' ? 'bg-purple-400 animate-ping' : p.severity === 'SEPTIC_SHOCK' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">[{p.id}]</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
            <span>MRN: <strong className="text-slate-200">{patient.mrn}</strong></span>
            <span>LOC: <strong className="text-cyan-400">{patient.location}</strong></span>
            <span>DX: <span className="text-slate-300 truncate max-w-[200px]">{patient.diagnosis}</span></span>
          </div>
        </div>
      </header>

      {/* Main Command Station Workspace */}
      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Critical Telemetry & Resuscitation Bar */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: MAP & Hemodynamics */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Activity className="w-4 h-4" /> MEAN ARTERIAL PRESSURE
              </span>
              <span className="font-mono">TARGET &ge; 65</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.map < 65 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {patient.map}
              </span>
              <span className="text-xs text-slate-400 font-mono">mmHg</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>BP: {patient.systolicBp}/{patient.diastolicBp}</span>
              <span className={`font-semibold ${patient.map < 65 ? 'text-rose-400' : 'text-slate-300'}`}>
                {patient.map < 65 ? 'HYPOTENSIVE' : 'PERFUSING'}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.map < 65 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (patient.map / 90) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Blood Lactate & Clearance Kinetics */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Flame className="w-4 h-4" /> SERUM LACTATE
              </span>
              <span className="font-mono">INIT: {patient.lactateInitial}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.lactateCurrent > 2.0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {patient.lactateCurrent}
              </span>
              <span className="text-xs text-slate-400 font-mono">mmol/L</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>CLEARANCE: <strong className={lactateClearancePct >= 10 ? 'text-emerald-400' : 'text-rose-400'}>{lactateClearancePct}%</strong></span>
              <span className="text-[10px] font-mono">{lactateClearancePct >= 10 ? 'ADEQUATE' : 'IMPAIRED'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${lactateClearancePct >= 10 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.max(10, Math.min(100, lactateClearancePct + 50))}%` }}
              />
            </div>
          </div>

          {/* Card 3: SOFA Organ Dysfunction Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Layers className="w-4 h-4" /> SOFA TOTAL SCORE
              </span>
              <span className="font-mono">qSOFA: {patient.qsofaScore}/3</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-purple-300">
                {patient.sofaScore}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 24</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>ICU MORTALITY: <strong className="text-rose-400">{patient.sofaScore >= 10 ? '50-80%' : patient.sofaScore >= 6 ? '20-30%' : '< 15%'}</strong></span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (patient.sofaScore / 24) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: Norepinephrine Equivalent Dose (NED) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Syringe className="w-4 h-4" /> VASOPRESSOR (NED)
              </span>
              <span className="font-mono">VIS: {patient.vasopressor.visScore}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${nedMcgKgMin > 0.25 ? 'text-rose-400' : 'text-slate-200'}`}>
                {nedMcgKgMin}
              </span>
              <span className="text-xs text-slate-400 font-mono">mcg/kg/min</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>NE: {patient.vasopressor.neRate} &bull; Vaso: {patient.vasopressor.vasoUnits || 0} U/min</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${nedMcgKgMin > 0.25 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                style={{ width: `${Math.min(100, (nedMcgKgMin / 0.5) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 5: Crystalloid Volume Resuscitation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Droplet className="w-4 h-4" /> 30 mL/kg CRYSTALLOID
              </span>
              <span className="font-mono">{patient.fluidGivenMl >= patient.fluidTargetMl ? '100%' : 'IN PROGRESS'}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-cyan-300">
                {patient.fluidGivenMl}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ {patient.fluidTargetMl} mL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>BALANCED CRYSTALLOID</span>
              <span className="text-emerald-400 font-semibold">{patient.fluidGivenMl >= patient.fluidTargetMl ? 'TARGET MET' : 'INFUSING'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-cyan-400"
                style={{ width: `${Math.min(100, (patient.fluidGivenMl / patient.fluidTargetMl) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 6: Procalcitonin & Inflammatory Cascade */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Microscope className="w-4 h-4" /> PROCALCITONIN
              </span>
              <span className="font-mono">&gt; 2.0 = SEPSIS</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-emerald-400">
                {patient.procalcitonin}
              </span>
              <span className="text-xs text-slate-400 font-mono">mcg/L</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              <span>{patient.procalcitonin > 10 ? 'Severe Bacterial Sepsis Risk' : 'Moderate Bacterial Risk'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, (patient.procalcitonin / 35) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'TELEMETRY', label: 'Clinical Telemetry & Waveforms', icon: Activity },
            { id: 'SSC_BUNDLE', label: 'Surviving Sepsis 1-Hour Bundle', icon: Timer },
            { id: 'SOFA_ORGAN', label: 'Multi-Organ SOFA Breakdown', icon: Layers },
            { id: 'PK_PD_STEWARDSHIP', label: 'Antimicrobial PK/PD & Antibiogram', icon: Pill },
            { id: 'PROTOCOLS', label: 'Audit Trail & Emergency Protocols', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: TELEMETRY STREAM & LIVE CHARTS */}
        {activeTab === 'TELEMETRY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Live Vital Trends Waveforms */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Waves className="w-4 h-4 text-cyan-400" />
                      Arterial Line Mean Arterial Pressure & Heart Rate Waveform Stream
                    </h3>
                    <p className="text-xs text-slate-400">Continuous 30-second rolling telemetry window</p>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
                    SPO2: {patient.spo2}% &bull; TEMP: {patient.tempC}&deg;C
                  </span>
                </div>

                {/* Simulated Waveform Visualizer */}
                <div className="h-44 bg-slate-950 rounded-lg border border-slate-800/80 p-3 flex items-end justify-between gap-1 overflow-hidden relative">
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-400 flex items-center gap-3">
                    <span>&mdash; MAP (mmHg)</span>
                    <span className="text-rose-400">&mdash; Heart Rate (BPM)</span>
                  </div>
                  {vitalStream.map((point, index) => {
                    const mapHeight = Math.max(15, Math.min(100, ((point.map - 40) / 60) * 100));
                    const hrHeight = Math.max(15, Math.min(100, ((point.heartRate - 50) / 100) * 100));
                    return (
                      <div key={index} className="flex-1 flex items-end justify-center gap-0.5 h-full group relative">
                        <div
                          className="w-1.5 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all duration-300 group-hover:bg-cyan-300"
                          style={{ height: `${mapHeight}%` }}
                        />
                        <div
                          className="w-1.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t transition-all duration-300 group-hover:bg-rose-300"
                          style={{ height: `${hrHeight}%` }}
                        />
                        {/* Hover Tooltip */}
                        <div className="hidden group-hover:block absolute -top-10 bg-slate-800 text-[10px] font-mono p-1 rounded border border-slate-700 z-10 whitespace-nowrap shadow-md">
                          MAP: {Math.round(point.map)} | HR: {Math.round(point.heartRate)} | {point.time}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vital Snapshot Grid */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Heart Rate</span>
                    <span className="text-lg font-bold font-mono text-rose-400">{patient.heartRate} BPM</span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Resp Rate</span>
                    <span className="text-lg font-bold font-mono text-amber-400">{patient.respRate} /min</span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Core Temp</span>
                    <span className="text-lg font-bold font-mono text-purple-400">{patient.tempC} &deg;C</span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">PaO2 / FiO2</span>
                    <span className="text-lg font-bold font-mono text-cyan-400">{Math.round(patient.pao2 / patient.fio2)}</span>
                  </div>
                </div>
              </div>

              {/* Lactate Kinetics & Serial Clearance Graph */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      Dynamic Lactate Kinetics & Clearance Velocity
                    </h3>
                    <p className="text-xs text-slate-400">Target &gt; 10% clearance per 2-hour interval towards &le; 2.0 mmol/L</p>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${lactateClearancePct >= 10 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                    Clearance: {lactateClearancePct}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Baseline T0 Lactate</span>
                    <span className="text-xl font-bold font-mono text-slate-200">{patient.lactateInitial} mmol/L</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Current T+2h Lactate</span>
                    <span className="text-xl font-bold font-mono text-amber-400">{patient.lactateCurrent} mmol/L</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400 block">Metabolic Interpretation</span>
                    <span className="text-xs font-semibold text-emerald-400 block mt-1">
                      {patient.lactateCurrent <= 2.0 ? 'Lactate Cleared' : lactateClearancePct >= 10 ? 'Favorable Resuscitation Response' : 'Ongoing Tissue Hypoxia / Liver Dysfunction'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Vasopressor Titration & Organ Support Overview */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-rose-400" />
                  Vasopressor Titration Station
                </h3>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-slate-200">Norepinephrine (Levophed)</span>
                      <span className="font-mono text-rose-400">{patient.vasopressor.neRate} mcg/kg/min</span>
                    </div>
                    <p className="text-[11px] text-slate-400">First-line agent for septic shock to maintain MAP &ge; 65 mmHg.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-slate-200">Vasopressin (Pitressin)</span>
                      <span className="font-mono text-cyan-400">{patient.vasopressor.vasoUnits || 0.0} units/min</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Second-line non-titrated adjunct (0.03 U/min) when NE &gt; 0.25 mcg/kg/min.</p>
                  </div>

                  {patient.vasopressor.epiRate ? (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-slate-200">Epinephrine Infusion</span>
                        <span className="font-mono text-purple-400">{patient.vasopressor.epiRate} mcg/kg/min</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Third-line inotrope/vasopressor for refractory vasodilatory shock.</p>
                    </div>
                  ) : null}
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950/80 border border-rose-900/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                    <span>Norepinephrine Equivalent Dose (NED)</span>
                    <span className="font-mono text-sm">{nedMcgKgMin} mcg/kg/min</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {nedMcgKgMin >= 0.5 ? 'Extreme vasopressor requirements. High mortality risk; consider Angiotensin II or HAT protocol.' : nedMcgKgMin >= 0.25 ? 'High vasopressor support. Second-line Vasopressin indicated.' : 'Moderate vasopressor support.'}
                  </p>
                </div>
              </div>

              {/* Microbiology Rapid Diagnostics Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bug className="w-4 h-4 text-emerald-400" />
                  Rapid Molecular Microbiology
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px] font-mono">Blood Culture Gram Stain</span>
                    <span className="text-slate-200 font-semibold">{patient.microbiology.bloodCultureStatus}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px] font-mono">Pathogen Identification</span>
                    <span className="text-emerald-400 font-semibold">{patient.microbiology.organism}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px] font-mono">PCR Resistance Determinant</span>
                    <span className="text-purple-300 font-mono">{patient.microbiology.pcrMarker}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SURVIVING SEPSIS 1-HOUR CARE BUNDLE */}
        {activeTab === 'SSC_BUNDLE' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Timer className="w-5 h-5 text-rose-400" />
                  Surviving Sepsis Campaign 1-Hour Care Bundle Execution Engine
                </h2>
                <p className="text-xs text-slate-400">
                  Target: Complete all bundle elements within 60 minutes of sepsis recognition (Time Zero).
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Elapsed Time</span>
                  <span className="text-xl font-mono font-bold text-rose-400">{patient.bundleElapsedMinutes}m / 60m</span>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-rose-500 flex items-center justify-center font-mono font-bold text-xs bg-slate-950 text-white">
                  {Math.round((patient.bundleElapsedMinutes / 60) * 100)}%
                </div>
              </div>
            </div>

            {/* Interactive Bundle Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'LACTATE_INITIAL',
                  title: '1. Measure Blood Lactate Level',
                  completed: patient.sscBundle.lactateInitial,
                  details: `Initial: ${patient.lactateInitial} mmol/L (Target: Point-of-care within 60 min)`,
                  guideline: 'SSC 2021 Rec 1.1',
                },
                {
                  id: 'BLOOD_CULTURES',
                  title: '2. Blood Cultures Prior to Antimicrobial Administration',
                  completed: patient.sscBundle.bloodCultures,
                  details: '2 sets drawn (aerobic & anaerobic); avoid antibiotic delay > 45 min.',
                  guideline: 'SSC 2021 Rec 1.2',
                },
                {
                  id: 'BROAD_ANTIBIOTICS',
                  title: '3. Administer Broad-Spectrum IV Antimicrobials',
                  completed: patient.sscBundle.broadAntibiotics,
                  details: `Infusing: ${patient.antimicrobials.map((a) => a.drug).join(' + ')}`,
                  guideline: 'SSC 2021 Rec 1.3',
                },
                {
                  id: 'FLUID_BOLUS',
                  title: '4. Rapid IV Crystalloid Bolus (30 mL/kg)',
                  completed: patient.sscBundle.fluidBolus,
                  details: `${patient.fluidGivenMl} mL given of ${patient.fluidTargetMl} mL target`,
                  guideline: 'SSC 2021 Rec 1.4',
                },
                {
                  id: 'VASOPRESSORS',
                  title: '5. Vasopressors to Maintain MAP >= 65 mmHg',
                  completed: patient.sscBundle.vasopressors,
                  details: `Norepinephrine titrated to MAP ${patient.map} mmHg`,
                  guideline: 'SSC 2021 Rec 1.5',
                },
                {
                  id: 'LACTATE_REPEAT',
                  title: '6. Serial Lactate Reassessment & Clearance',
                  completed: patient.sscBundle.lactateRepeat,
                  details: `Repeat Lactate: ${patient.lactateCurrent} mmol/L (Clearance: ${lactateClearancePct}%)`,
                  guideline: 'SSC 2021 Rec 1.6',
                },
              ].map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    item.completed
                      ? 'bg-slate-950/80 border-emerald-500/50 shadow-md'
                      : 'bg-slate-950/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-mono text-cyan-400">{item.guideline}</span>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400">{item.details}</p>
                    </div>
                    <div className={`p-1.5 rounded-full ${item.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MULTI-ORGAN SOFA BREAKDOWN */}
        {activeTab === 'SOFA_ORGAN' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Sequential Organ Failure Assessment (SOFA) Organ Matrix
              </h2>
              <p className="text-xs text-slate-400">
                Sepsis-3 consensus organ dysfunction criteria across 6 critical physiological domains.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Organ 1: Respiration */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-cyan-400">RESPIRATORY SYSTEM</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold">
                    Score: {Math.round(patient.pao2 / patient.fio2) < 200 ? 3 : Math.round(patient.pao2 / patient.fio2) < 300 ? 2 : 1}/4
                  </span>
                </div>
                <div className="text-sm font-mono text-slate-200">PaO2 / FiO2: {Math.round(patient.pao2 / patient.fio2)} mmHg</div>
                <p className="text-xs text-slate-400">PaO2 {patient.pao2} mmHg on FiO2 {patient.fio2 * 100}% ventilatory support.</p>
              </div>

              {/* Organ 2: Coagulation */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-400">COAGULATION</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold">
                    Score: {patient.platelets < 50 ? 3 : patient.platelets < 100 ? 2 : patient.platelets < 150 ? 1 : 0}/4
                  </span>
                </div>
                <div className="text-sm font-mono text-slate-200">Platelets: {patient.platelets} &times;10&sup3;/&mu;L</div>
                <p className="text-xs text-slate-400">Sepsis-induced thrombocytopenia & consumable coagulopathy screening.</p>
              </div>

              {/* Organ 3: Liver */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-400">HEPATIC DYSFUNCTION</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                    Score: {patient.bilirubin >= 6.0 ? 3 : patient.bilirubin >= 2.0 ? 2 : patient.bilirubin >= 1.2 ? 1 : 0}/4
                  </span>
                </div>
                <div className="text-sm font-mono text-slate-200">Total Bilirubin: {patient.bilirubin} mg/dL</div>
                <p className="text-xs text-slate-400">Cholestasis of sepsis & ischemic hepatitis indicator.</p>
              </div>

              {/* Organ 4: Cardiovascular */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-400">CARDIOVASCULAR</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold">
                    Score: {patient.vasopressor.neRate > 0.1 ? 4 : patient.vasopressor.neRate > 0 ? 3 : patient.map < 70 ? 1 : 0}/4
                  </span>
                </div>
                <div className="text-sm font-mono text-slate-200">MAP {patient.map} mmHg &bull; NE {patient.vasopressor.neRate} &mu;g/kg/min</div>
                <p className="text-xs text-slate-400">Vasodilatory shock requiring continuous inotropic/vasopressor titration.</p>
              </div>

              {/* Organ 5: Central Nervous System */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-purple-400">CENTRAL NERVOUS SYSTEM</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-bold">
                    Score: {patient.gcs <= 9 ? 3 : patient.gcs <= 12 ? 2 : patient.gcs <= 14 ? 1 : 0}/4
                  </span>
                </div>
                <div className="text-sm font-mono text-slate-200">Glasgow Coma Scale: {patient.gcs} / 15</div>
                <p className="text-xs text-slate-400">Sepsis-associated encephalopathy (SAE) monitoring.</p>
              </div>

              {/* Organ 6: Renal Function */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-400">RENAL FUNCTION</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-bold">
                    Score: {patient.creatinine >= 3.5 ? 3 : patient.creatinine >= 2.0 ? 2 : patient.creatinine >= 1.2 ? 1 : 0}/4
                  </span>
                </div>
                <div className="text-sm font-mono text-slate-200">Creatinine: {patient.creatinine} mg/dL &bull; UO: {patient.urineOutputMlHr} mL/hr</div>
                <p className="text-xs text-slate-400">Acute tubular necrosis / septic AKI stage evaluation.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ANTIMICROBIAL PK/PD & STEWARDSHIP */}
        {activeTab === 'PK_PD_STEWARDSHIP' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-cyan-400" />
                Antimicrobial Pharmacokinetic / Pharmacodynamic (PK/PD) Therapeutic Monitoring
              </h2>
              <p className="text-xs text-slate-400">
                Precision Bayesian AUC24:MIC estimation, continuous infusion optimization, and pathogen-targeted de-escalation.
              </p>
            </div>

            {/* Active Regimen PK/PD Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patient.antimicrobials.map((abx, idx) => (
                <div key={idx} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                        <Beaker className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{abx.drug}</h4>
                        <span className="text-xs text-slate-400">{abx.regimen}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      {abx.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block text-[10px]">MEASURED TROUGH</span>
                      <span className="text-slate-200 font-bold">{abx.measuredTrough} mcg/mL</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">TARGET TROUGH</span>
                      <span className="text-cyan-400">{abx.targetTrough}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">ESTIMATED AUC24</span>
                      <span className="text-slate-200 font-bold">{abx.estimatedAuc24} mg*h/L</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">TARGET PK/PD</span>
                      <span className="text-emerald-400">{abx.targetAuc24}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Stewardship De-Escalation Advisor */}
            <div className="bg-slate-950 p-5 rounded-xl border border-cyan-900/50 space-y-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">AI Clinical Antimicrobial Stewardship Recommendations</h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start space-x-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-300">Targeted De-Escalation Alert: </strong>
                    Blood culture yields {patient.microbiology.organism}. Evaluate discontinuing redundant Gram-positive empirical coverage if blood cultures remain negative for MRSA at 48 hours.
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start space-x-3">
                  <Activity className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-cyan-300">Beta-Lactam Prolonged Infusion: </strong>
                    Maintaining 4-hour extended infusion of Meropenem achieves &gt; 98% fT &gt; 4x MIC for critical MIC &le; 2.0 mcg/mL in septic shock.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT TRAIL & EMERGENCY PROTOCOLS */}
        {activeTab === 'PROTOCOLS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  FDA 21 CFR Part 11 Electronic Signature & Clinical Audit Ledger
                </h2>
                <p className="text-xs text-slate-400">
                  Cryptographically verified, tamper-evident audit logs for all critical clinical decisions.
                </p>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Flame className="w-4 h-4" />
                Trigger New Protocol
              </button>
            </div>

            <div className="space-y-3">
              {signatureLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between text-xs gap-2">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      {log.protocol}
                    </span>
                    <span className="font-mono text-slate-400">{log.time} &bull; Signer: <strong className="text-slate-200">{log.signer}</strong></span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-300 break-all">
                    SHA-256 HASH: {log.hash}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* EMERGENCY PROTOCOL ACTIVATION MODAL */}
      {isProtocolModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-600 text-white">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Emergency Protocol Interlock Activation</h3>
                  <p className="text-xs text-slate-400">Patient: {patient.name} [{patient.id}]</p>
                </div>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-mono"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Resuscitation Protocol</label>
                <select
                  value={selectedProtocolToTrigger}
                  onChange={(e) => setSelectedProtocolToTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value="CODE_SEPSIS">Code Sepsis 1-Hour Activation (Broad Abx + 30 mL/kg Bolus)</option>
                  <option value="REFRACTORY_SEPTIC_SHOCK">Refractory Septic Shock (Vasopressin + Hydrocortisone + Angiotensin II)</option>
                  <option value="ANTIMICROBIAL_STEWARDSHIP_AUDIT">48-Hour Antimicrobial Time-Out & De-escalation</option>
                  <option value="MASSIVE_TRANSFUSION_SEPSIS_DIC">Sepsis-Induced DIC & Transfusion Support</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinician ID / Attending Electronic Signature</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Rationale & Indications</label>
                <textarea
                  rows={3}
                  value={activationRationale}
                  onChange={(e) => setActivationRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-[11px] text-rose-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>
                  By signing, you authenticate execution of the resuscitation protocol under FDA 21 CFR Part 11 and Surviving Sepsis Campaign clinical guidelines.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsProtocolModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateEmergencyProtocol}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <FileCheck className="w-4 h-4" />
                Sign & Activate Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
