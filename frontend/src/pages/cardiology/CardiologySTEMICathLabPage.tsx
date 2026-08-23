import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeAlert,
  Beaker,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Download,
  Droplet,
  FileCheck,
  FileSpreadsheet,
  Flame,
  Heart,
  HeartPulse,
  Layers,
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

interface VitalSnapshot {
  time: string;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  map: number;
  cardiacOutput: number;
  cpoWatts: number;
  stElevationMm: number;
  shockIndex: number;
}

interface StemiPatient {
  id: string;
  mrn: string;
  name: string;
  ageYears: number;
  sex: string;
  location: string;
  diagnosis: string;
  culpritVessel: string;
  ecgLeadChanges: string;
  severity: 'ACUTE_STEMI' | 'NSTEMI_VERY_HIGH_RISK' | 'CARDIOGENIC_SHOCK' | 'UNSTABLE_ANGINA';
  killipClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV';
  timiScore: number;
  graceScore: number;
  weightKg: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  map: number;
  cardiacOutput: number; // L/min
  cardiacIndex: number;  // L/min/m2
  cardiacPowerOutput: number; // W
  coronaryPerfusionPressure: number; // mmHg
  shockIndex: number;
  spo2: number;
  respRate: number;
  tempC: number;
  lactate: number;
  troponinIInitial: number;
  troponinICurrent: number;
  ckMb: number;
  daptRegimen: {
    aspirin: string;
    p2y12: string;
    anticoagulant: string;
    actSeconds: number;
    actTarget: string;
  };
  d2bTimerMinutes: number;
  d2bProgress: {
    doorToEcg: boolean;
    cathLabActivation: boolean;
    patientArrivalLab: boolean;
    arterialAccess: boolean;
    balloonTime: boolean;
    postPciAnticoagulation: boolean;
  };
}

const STEMI_PATIENTS_DATABASE: StemiPatient[] = [
  {
    id: 'STEMI-701',
    mrn: 'CAR-109482',
    name: 'Robert Hastings',
    ageYears: 63,
    sex: 'Male',
    location: 'Cardiac Cath Lab - Suite 01',
    diagnosis: 'Acute Anterior STEMI (Culprit LAD Occlusion)',
    culpritVessel: 'Left Anterior Descending (LAD) - Proximal 100% Thrombotic Occlusion (TIMI 0 Flow)',
    ecgLeadChanges: '4.5mm ST-Elevation in V1-V4 with reciprocal ST depression in II, III, aVF',
    severity: 'ACUTE_STEMI',
    killipClass: 'CLASS_II',
    timiScore: 6,
    graceScore: 168,
    weightKg: 78,
    heartRate: 112,
    systolicBp: 96,
    diastolicBp: 58,
    map: 70.7,
    cardiacOutput: 3.8,
    cardiacIndex: 2.1,
    cardiacPowerOutput: 0.59,
    coronaryPerfusionPressure: 44,
    shockIndex: 1.16,
    spo2: 95,
    respRate: 22,
    tempC: 36.8,
    lactate: 2.8,
    troponinIInitial: 4.82,
    troponinICurrent: 18.9,
    ckMb: 76,
    daptRegimen: {
      aspirin: 'Aspirin 325mg PO Chewed (Administered @ T-15m)',
      p2y12: 'Ticagrelor 180mg Loading Dose PO (Administered @ T-10m)',
      anticoagulant: 'Unfractionated Heparin 5000 units IV Bolus',
      actSeconds: 278,
      actTarget: '250 - 300 seconds',
    },
    d2bTimerMinutes: 38,
    d2bProgress: {
      doorToEcg: true,
      cathLabActivation: true,
      patientArrivalLab: true,
      arterialAccess: true,
      balloonTime: false,
      postPciAnticoagulation: false,
    },
  },
  {
    id: 'STEMI-702',
    mrn: 'CAR-882319',
    name: 'Eleanor Vance',
    ageYears: 74,
    sex: 'Female',
    location: 'CCU - Bed 02 (Cardiogenic Shock Holding)',
    diagnosis: 'Acute Inferoposterior STEMI with RV Infarction & Cardiogenic Shock',
    culpritVessel: 'Right Coronary Artery (RCA) - Proximal Acute Ectatic Thrombus',
    ecgLeadChanges: 'ST-Elevation in II, III, aVF, V4R (1.5mm) with Complete AV Heart Block',
    severity: 'CARDIOGENIC_SHOCK',
    killipClass: 'CLASS_IV',
    timiScore: 9,
    graceScore: 215,
    weightKg: 64,
    heartRate: 46,
    systolicBp: 82,
    diastolicBp: 44,
    map: 56.6,
    cardiacOutput: 2.4,
    cardiacIndex: 1.4,
    cardiacPowerOutput: 0.30,
    coronaryPerfusionPressure: 32,
    shockIndex: 0.56,
    spo2: 91,
    respRate: 28,
    tempC: 36.4,
    lactate: 5.4,
    troponinIInitial: 12.4,
    troponinICurrent: 42.8,
    ckMb: 142,
    daptRegimen: {
      aspirin: 'Aspirin 325mg PO Chewed',
      p2y12: 'Prasugrel 60mg Loading Dose (Crushed via NGT)',
      anticoagulant: 'Bivalirudin 0.75 mg/kg bolus, 1.75 mg/kg/h infusion',
      actSeconds: 310,
      actTarget: '300 - 350 seconds',
    },
    d2bTimerMinutes: 52,
    d2bProgress: {
      doorToEcg: true,
      cathLabActivation: true,
      patientArrivalLab: true,
      arterialAccess: true,
      balloonTime: false,
      postPciAnticoagulation: true,
    },
  },
  {
    id: 'STEMI-703',
    mrn: 'CAR-554109',
    name: 'David Kincaid',
    ageYears: 58,
    sex: 'Male',
    location: 'Emergency Department - Resus 03',
    diagnosis: 'Very High-Risk NSTEMI with Refractory Rest Angina',
    culpritVessel: 'Left Circumflex (LCx) / Obtuse Marginal 1 Subtotal 99% Stenosis',
    ecgLeadChanges: 'Horizontal ST-Depression > 2mm in V4-V6 & Lead I, aVL with aVR ST Elevation',
    severity: 'NSTEMI_VERY_HIGH_RISK',
    killipClass: 'CLASS_I',
    timiScore: 4,
    graceScore: 142,
    weightKg: 85,
    heartRate: 98,
    systolicBp: 138,
    diastolicBp: 84,
    map: 102.0,
    cardiacOutput: 4.8,
    cardiacIndex: 2.4,
    cardiacPowerOutput: 1.08,
    coronaryPerfusionPressure: 68,
    shockIndex: 0.71,
    spo2: 98,
    respRate: 18,
    tempC: 37.1,
    lactate: 1.4,
    troponinIInitial: 0.88,
    troponinICurrent: 3.42,
    ckMb: 32,
    daptRegimen: {
      aspirin: 'Aspirin 325mg PO Chewed',
      p2y12: 'Ticagrelor 180mg Loading Dose',
      anticoagulant: 'Enoxaparin 1mg/kg SubQ q12h',
      actSeconds: 240,
      actTarget: '200 - 250 seconds',
    },
    d2bTimerMinutes: 22,
    d2bProgress: {
      doorToEcg: true,
      cathLabActivation: true,
      patientArrivalLab: false,
      arterialAccess: false,
      balloonTime: false,
      postPciAnticoagulation: false,
    },
  },
];

export default function CardiologySTEMICathLabPage() {
  const [patients, setPatients] = useState<StemiPatient[]>(STEMI_PATIENTS_DATABASE);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('STEMI-701');
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [tickCount, setTickCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'D2B_TIMELINE' | 'HEMODYNAMICS' | 'KILLIP_TIMI' | 'PROTOCOLS'>('TELEMETRY');

  // Emergency Modal State
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState<boolean>(false);
  const [selectedProtocolToTrigger, setSelectedProtocolToTrigger] = useState<string>('CODE_STEMI_CATH_LAB');
  const [clinicianId, setClinicianId] = useState<string>('MD-CATH-8812 (Dr. James Thornton)');
  const [activationRationale, setActivationRationale] = useState<string>('Acute proximal LAD 100% occlusion with ST elevation > 4mm in V1-V4; immediate primary PCI.');
  const [signatureLogs, setSignatureLogs] = useState<Array<{ id: string; time: string; signer: string; protocol: string; hash: string }>>([
    {
      id: 'SIG-STEMI-101',
      time: new Date(Date.now() - 1000 * 60 * 20).toLocaleTimeString(),
      signer: 'Dr. James Thornton (MD-CATH-8812)',
      protocol: 'Primary PCI Cath Lab Emergent Activation',
      hash: 'b7c4a10e8293dd41f8742ca910d65b7194c2510f92b74c0b62e49c71629fa901',
    },
  ]);

  // Selected Patient
  const patient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  // Dynamic CPO calculation
  const dynamicCpo = useMemo(() => {
    return Math.round(((patient.map * patient.cardiacOutput) / 451) * 100) / 100;
  }, [patient.map, patient.cardiacOutput]);

  // Dynamic Shock Index
  const dynamicShockIndex = useMemo(() => {
    if (!patient.systolicBp || patient.systolicBp <= 0) return 0;
    return Math.round((patient.heartRate / patient.systolicBp) * 100) / 100;
  }, [patient.heartRate, patient.systolicBp]);

  // Vital stream buffer
  const [vitalStream, setVitalStream] = useState<VitalSnapshot[]>(() => {
    const list: VitalSnapshot[] = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      list.push({
        time: new Date(now - i * 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        heartRate: 110 + Math.sin(i) * 5,
        systolicBp: 95 + Math.cos(i) * 4,
        diastolicBp: 58 + Math.sin(i) * 2,
        map: 70 + Math.sin(i) * 3,
        cardiacOutput: 3.8 + Math.sin(i * 2) * 0.2,
        cpoWatts: 0.59,
        stElevationMm: 4.5 + Math.sin(i) * 0.3,
        shockIndex: 1.15,
      });
    }
    return list;
  });

  // Telemetry tick engine
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setTickCount((prev) => prev + 1);

      setPatients((prevList) =>
        prevList.map((p) => {
          if (p.id !== selectedPatientId) return p;

          const hrFluct = (Math.random() - 0.5) * 2.0;
          const sbpFluct = (Math.random() - 0.5) * 3.0;
          const newHr = Math.max(40, Math.min(180, Math.round(p.heartRate + hrFluct)));
          const newSbp = Math.max(50, Math.min(220, Math.round(p.systolicBp + sbpFluct)));
          const newDbp = Math.max(30, Math.min(130, Math.round(p.diastolicBp + sbpFluct * 0.5)));
          const newMap = Math.round(((newSbp + 2 * newDbp) / 3) * 10) / 10;
          const newCo = Math.max(1.5, Math.min(8.0, Math.round((p.cardiacOutput + (Math.random() - 0.5) * 0.05) * 100) / 100));
          const newCpo = Math.round(((newMap * newCo) / 451) * 100) / 100;

          return {
            ...p,
            heartRate: newHr,
            systolicBp: newSbp,
            diastolicBp: newDbp,
            map: newMap,
            cardiacOutput: newCo,
            cardiacPowerOutput: newCpo,
          };
        }),
      );

      // Append vital snapshot
      setVitalStream((prev) => {
        const nextTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newSnapshot: VitalSnapshot = {
          time: nextTime,
          heartRate: patient.heartRate,
          systolicBp: patient.systolicBp,
          diastolicBp: patient.diastolicBp,
          map: patient.map,
          cardiacOutput: patient.cardiacOutput,
          cpoWatts: dynamicCpo,
          stElevationMm: 4.5,
          shockIndex: dynamicShockIndex,
        };
        return [...prev.slice(1), newSnapshot];
      });
    }, 1500 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed, selectedPatientId, patient, dynamicCpo, dynamicShockIndex]);

  // Protocol Trigger Handler
  const handleActivateEmergencyProtocol = useCallback(() => {
    const newHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const newLog = {
      id: `SIG-STEMI-${Math.floor(1000 + Math.random() * 9000)}`,
      time: new Date().toLocaleTimeString(),
      signer: clinicianId,
      protocol: selectedProtocolToTrigger,
      hash: newHash,
    };

    setSignatureLogs((prev) => [newLog, ...prev]);

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === selectedPatientId) {
          return {
            ...p,
            d2bProgress: {
              ...p.d2bProgress,
              cathLabActivation: true,
              patientArrivalLab: true,
            },
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
      identifier: { system: 'https://medtrack.hospital.org/fhir/stemi', value: `STEMI-FHIR-${patient.id}-${Date.now()}` },
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
            id: `obs-cpo-${patient.id}`,
            code: { text: 'Cardiac Power Output' },
            valueQuantity: { value: dynamicCpo, unit: 'W' },
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-troponin-${patient.id}`,
            code: { text: 'High-Sensitivity Troponin I' },
            valueQuantity: { value: patient.troponinICurrent, unit: 'ng/mL' },
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-stemi-${patient.id}`,
            title: 'ACC/AHA Primary Percutaneous Coronary Intervention Protocol',
            description: `Culprit: ${patient.culpritVessel} | Target D2B <= 90 min`,
          },
        },
      ],
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR_R4_STEMI_Bundle_${patient.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patient, dynamicCpo]);

  // Export CSV Report
  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Patient ID', 'MRN', 'Name', 'Diagnosis', 'Culprit Vessel', 'Killip Class', 'TIMI Score', 'GRACE Score', 'HR (BPM)', 'BP (mmHg)', 'MAP', 'Cardiac Output (L/min)', 'CPO (W)', 'Shock Index', 'ACT (s)', 'D2B Time (min)'],
      [
        patient.id,
        patient.mrn,
        patient.name,
        patient.diagnosis,
        patient.culpritVessel,
        patient.killipClass,
        patient.timiScore,
        patient.graceScore,
        patient.heartRate,
        `${patient.systolicBp}/${patient.diastolicBp}`,
        patient.map,
        patient.cardiacOutput,
        dynamicCpo,
        dynamicShockIndex,
        patient.daptRegimen.actSeconds,
        patient.d2bTimerMinutes,
      ],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `STEMI_CathLab_Telemetry_${patient.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patient, dynamicCpo, dynamicShockIndex]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-rose-500 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-600 to-red-600 shadow-lg shadow-rose-950/50 flex items-center justify-center ring-2 ring-rose-400/30 animate-pulse">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MEDTRACK CARDIOLOGY COMMAND STATION
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-widest">
                    ACC/AHA Code STEMI Cath Lab
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Door-to-Balloon &le; 90m &bull; Cardiac Power Output &bull; Killip &amp; TIMI Risk &bull; 12-Lead ST Telemetry &bull; FDA 21 CFR Part 11
              </p>
            </div>
          </div>

          {/* Controls & Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
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

            <button
              onClick={() => setIsProtocolModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg shadow-rose-950/50 border border-rose-400/30 transition-all transform active:scale-95"
            >
              <Flame className="w-4 h-4 animate-bounce" />
              CODE STEMI ACTIVATION
            </button>

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
              <Users className="w-3.5 h-3.5 text-rose-400" /> STEMI / ACS Cohort:
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
                    <span className={`w-2 h-2 rounded-full ${p.severity === 'CARDIOGENIC_SHOCK' ? 'bg-purple-400 animate-ping' : p.severity === 'ACUTE_STEMI' ? 'bg-rose-400' : 'bg-amber-400'}`} />
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
            <span>KILLIP: <strong className="text-rose-400">{patient.killipClass.replace('CLASS_', '')}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Hero Critical Telemetry Metrics */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: Cardiac Power Output (CPO) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-400">
                <Heart className="w-4 h-4" /> CARDIAC POWER OUTPUT
              </span>
              <span className="font-mono">TARGET &ge; 0.60 W</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${dynamicCpo < 0.6 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {dynamicCpo}
              </span>
              <span className="text-xs text-slate-400 font-mono">Watts</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>CO: {patient.cardiacOutput} L/min</span>
              <span className={`font-semibold ${dynamicCpo < 0.6 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {dynamicCpo < 0.6 ? 'SHOCK CRITICAL' : 'ADEQUATE'}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${dynamicCpo < 0.6 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (dynamicCpo / 1.2) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Door-to-Balloon (D2B) Timer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Timer className="w-4 h-4" /> DOOR-TO-BALLOON (D2B)
              </span>
              <span className="font-mono">GOAL &le; 90 MIN</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${patient.d2bTimerMinutes > 90 ? 'text-rose-400' : 'text-cyan-300'}`}>
                {patient.d2bTimerMinutes}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 90 min</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>STATUS:</span>
              <span className="text-emerald-400 font-semibold">{patient.d2bTimerMinutes <= 90 ? 'ON SCHEDULE' : 'BREACH'}</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${patient.d2bTimerMinutes > 90 ? 'bg-rose-500' : 'bg-cyan-400'}`}
                style={{ width: `${Math.min(100, (patient.d2bTimerMinutes / 90) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 3: Shock Index */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Zap className="w-4 h-4" /> SHOCK INDEX (HR/SBP)
              </span>
              <span className="font-mono">NORM 0.5-0.7</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-3xl font-black font-mono ${dynamicShockIndex > 0.9 ? 'text-rose-400' : 'text-amber-400'}`}>
                {dynamicShockIndex}
              </span>
              <span className="text-xs text-slate-400 font-mono">SI</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>HR {patient.heartRate} / SBP {patient.systolicBp}</span>
              <span className={`font-semibold ${dynamicShockIndex > 1.0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {dynamicShockIndex > 1.0 ? 'SEVERE LV FAILURE' : 'ELEVATED'}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${dynamicShockIndex > 1.0 ? 'bg-rose-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (dynamicShockIndex / 1.5) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 4: TIMI Risk Score */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Layers className="w-4 h-4" /> TIMI STEMI SCORE
              </span>
              <span className="font-mono">GRACE: {patient.graceScore}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-purple-300">
                {patient.timiScore}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 14 pts</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>30-DAY MORTALITY: <strong className="text-rose-400">{patient.timiScore >= 8 ? '35.9%' : patient.timiScore >= 6 ? '16.1%' : '7.3%'}</strong></span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (patient.timiScore / 14) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 5: High-Sensitivity Troponin I */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-300">
                <Flame className="w-4 h-4" /> hs-cTnI TROPONIN
              </span>
              <span className="font-mono">INIT: {patient.troponinIInitial}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-rose-300">
                {patient.troponinICurrent}
              </span>
              <span className="text-xs text-slate-400 font-mono">ng/mL</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>CK-MB: {patient.ckMb} U/L</span>
              <span className="text-rose-400 font-semibold">INFARCTION DELTA</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{ width: `${Math.min(100, (patient.troponinICurrent / 50) * 100)}%` }}
              />
            </div>
          </div>

          {/* Card 6: Anticoagulation ACT Seconds */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Beaker className="w-4 h-4" /> HEPARIN ACT
              </span>
              <span className="font-mono">TARGET 250-300s</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black font-mono text-emerald-400">
                {patient.daptRegimen.actSeconds}
              </span>
              <span className="text-xs text-slate-400 font-mono">sec</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>THERAPEUTIC PCI</span>
              <span className="text-emerald-400 font-semibold">OPTIMAL ACT</span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.min(100, (patient.daptRegimen.actSeconds / 350) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          {[
            { id: 'TELEMETRY', label: '12-Lead ST Telemetry & Waveforms', icon: Activity },
            { id: 'D2B_TIMELINE', label: 'Door-to-Balloon 90m Milestones', icon: Timer },
            { id: 'HEMODYNAMICS', label: 'Hemodynamics & Coronary Perfusion', icon: HeartPulse },
            { id: 'KILLIP_TIMI', label: 'Killip & TIMI Risk Stratification', icon: Layers },
            { id: 'PROTOCOLS', label: 'Cath Lab Code STEMI Protocols', icon: ShieldCheck },
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

        {/* TAB 1: TELEMETRY STREAM */}
        {activeTab === 'TELEMETRY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Waves className="w-4 h-4 text-cyan-400" />
                      Continuous 12-Lead ST-Elevation & Arterial Pressure Telemetry Stream
                    </h3>
                    <p className="text-xs text-slate-400">{patient.ecgLeadChanges}</p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold animate-pulse">
                    ST ELEVATION: 4.5 mm (V1-V4)
                  </span>
                </div>

                {/* Waveform visualizer */}
                <div className="h-44 bg-slate-950 rounded-lg border border-slate-800 p-3 flex items-end justify-between gap-1 overflow-hidden relative">
                  <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-400 flex items-center gap-3">
                    <span>&mdash; SBP / MAP Waveform (mmHg)</span>
                    <span className="text-rose-400">&mdash; Heart Rate (BPM)</span>
                  </div>
                  {vitalStream.map((point, index) => {
                    const bpHeight = Math.max(15, Math.min(100, ((point.systolicBp - 40) / 120) * 100));
                    const hrHeight = Math.max(15, Math.min(100, ((point.heartRate - 40) / 120) * 100));
                    return (
                      <div key={index} className="flex-1 flex items-end justify-center gap-0.5 h-full group relative">
                        <div
                          className="w-1.5 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all duration-300 group-hover:bg-cyan-300"
                          style={{ height: `${bpHeight}%` }}
                        />
                        <div
                          className="w-1.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t transition-all duration-300 group-hover:bg-rose-300"
                          style={{ height: `${hrHeight}%` }}
                        />
                        <div className="hidden group-hover:block absolute -top-10 bg-slate-800 text-[10px] font-mono p-1 rounded border border-slate-700 z-10 whitespace-nowrap shadow-md">
                          BP: {Math.round(point.systolicBp)}/{Math.round(point.diastolicBp)} | HR: {Math.round(point.heartRate)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Culprit Vessel & Lesion Box */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-rose-900/60 space-y-1">
                  <span className="text-xs font-mono text-rose-400 font-bold block">CULPRIT CORONARY VESSEL &amp; MORPHOLOGY:</span>
                  <p className="text-xs font-semibold text-slate-200">{patient.culpritVessel}</p>
                </div>
              </div>

              {/* DAPT Regimen & Antithrombotic Monitoring */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-400" />
                  Dual Antiplatelet Therapy (DAPT) &amp; Anticoagulation Protocol
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 font-mono text-[10px]">ASPIRIN LOADING</span>
                    <p className="text-slate-200 font-semibold">{patient.daptRegimen.aspirin}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 font-mono text-[10px]">P2Y12 RECEPTOR INHIBITOR</span>
                    <p className="text-cyan-300 font-semibold">{patient.daptRegimen.p2y12}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 font-mono text-[10px]">INTRA-PROCEDURAL ANTICOAGULANT</span>
                    <p className="text-emerald-300 font-semibold">{patient.daptRegimen.anticoagulant}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 font-mono text-[10px]">ACTIVATED CLOTTING TIME (ACT)</span>
                    <p className="text-amber-300 font-semibold">{patient.daptRegimen.actSeconds} sec (Goal: {patient.daptRegimen.actTarget})</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Diagnostic & Hemodynamic Summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-rose-400" />
                  Coronary Hemodynamics Summary
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Cardiac Output</span>
                    <span className="font-mono font-bold text-cyan-400">{patient.cardiacOutput} L/min</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Cardiac Index</span>
                    <span className="font-mono font-bold text-cyan-400">{patient.cardiacIndex} L/min/m&sup2;</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Cardiac Power Output</span>
                    <span className={`font-mono font-bold ${dynamicCpo < 0.6 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {dynamicCpo} Watts
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Coronary Perfusion Pressure</span>
                    <span className="font-mono font-bold text-emerald-400">{patient.coronaryPerfusionPressure} mmHg</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">Serum Lactate</span>
                    <span className="font-mono font-bold text-amber-400">{patient.lactate} mmol/L</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DOOR-TO-BALLOON 90M MILESTONES */}
        {activeTab === 'D2B_TIMELINE' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Timer className="w-5 h-5 text-cyan-400" />
                  ACC/AHA Door-to-Balloon (D2B) Quality Benchmark Execution Engine
                </h2>
                <p className="text-xs text-slate-400">
                  Target: Guidewire crossing and balloon inflation &le; 90 minutes from emergency presentation.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">D2B Clock</span>
                  <span className="text-xl font-mono font-bold text-cyan-300">{patient.d2bTimerMinutes}m / 90m</span>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-cyan-500 flex items-center justify-center font-mono font-bold text-xs bg-slate-950 text-white">
                  {Math.round((patient.d2bTimerMinutes / 90) * 100)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: '1. 12-Lead ECG Acquisition & Interpretation', target: '<= 10m', completed: patient.d2bProgress.doorToEcg, desc: 'Acquire and interpret within 10 min of arrival.' },
                { title: '2. Code STEMI Cath Lab Team Activation', target: '<= 20m', completed: patient.d2bProgress.cathLabActivation, desc: 'Single-call paging of on-call interventional team.' },
                { title: '3. Patient Transfer to Cath Lab Table', target: '<= 45m', completed: patient.d2bProgress.patientArrivalLab, desc: 'Direct transfer to suite bypassing inpatient holding.' },
                { title: '4. Vascular Access (Radial First)', target: '<= 60m', completed: patient.d2bProgress.arterialAccess, desc: 'Right radial artery ultrasound puncture & sheath placement.' },
                { title: '5. Guidewire Crossing & First Balloon Inflation', target: '<= 90m', completed: patient.d2bProgress.balloonTime, desc: 'Definitive restoration of TIMI 3 coronary blood flow.' },
                { title: '6. Heparin ACT Target Monitoring & DAPT', target: '<= 120m', completed: patient.d2bProgress.postPciAnticoagulation, desc: 'Maintain ACT 250-300s during intervention.' },
              ].map((m, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${m.completed ? 'bg-slate-950/80 border-emerald-500/50' : 'bg-slate-950/50 border-slate-800'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono text-cyan-400 font-bold">{m.target}</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{m.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
                    </div>
                    <div className={`p-1.5 rounded-full ${m.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: HEMODYNAMICS */}
        {activeTab === 'HEMODYNAMICS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-400" />
              Invasive Cardiovascular Hemodynamics &amp; Mechanical Support Evaluation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-rose-400 block uppercase">Cardiac Power Output (CPO)</span>
                <span className="text-2xl font-black font-mono text-white">{dynamicCpo} W</span>
                <p className="text-xs text-slate-400">Formula: (MAP &times; CO) / 451. Threshold &lt; 0.6 W triggers mechanical circulatory support (Impella CP / ECMO).</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-400 block uppercase">Coronary Perfusion Pressure (CPP)</span>
                <span className="text-2xl font-black font-mono text-white">{patient.coronaryPerfusionPressure} mmHg</span>
                <p className="text-xs text-slate-400">Formula: DBP - PAOP. Driving pressure across myocardial capillary bed.</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-400 block uppercase">Shock Index (SI)</span>
                <span className="text-2xl font-black font-mono text-white">{dynamicShockIndex}</span>
                <p className="text-xs text-slate-400">Formula: HR / SBP. SI &gt; 0.9 indicates severe left ventricular dysfunction.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KILLIP & TIMI RISK */}
        {activeTab === 'KILLIP_TIMI' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Killip Clinical Heart Failure &amp; TIMI STEMI Risk Stratification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Killip Heart Failure Classification</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="font-semibold text-slate-300">Killip I: No Heart Failure</span>
                    <span className="text-slate-400">5-6% Mortality</span>
                  </div>
                  <div className={`p-2.5 rounded border flex justify-between ${patient.killipClass === 'CLASS_II' ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                    <span>Killip II: Rales / S3 Gallop / Elevated JVP</span>
                    <span>17% Mortality</span>
                  </div>
                  <div className={`p-2.5 rounded border flex justify-between ${patient.killipClass === 'CLASS_III' ? 'bg-orange-950/60 border-orange-500 text-orange-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                    <span>Killip III: Frank Pulmonary Edema</span>
                    <span>38% Mortality</span>
                  </div>
                  <div className={`p-2.5 rounded border flex justify-between ${patient.killipClass === 'CLASS_IV' ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-bold animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                    <span>Killip IV: Cardiogenic Shock (CPO &lt; 0.6 W)</span>
                    <span>67-80% Mortality</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">TIMI Risk Score for STEMI (Score: {patient.timiScore}/14)</h3>
                <div className="text-xs text-slate-300 space-y-1.5">
                  <p>&bull; Age 65-74 (+2 pts) / Age &ge; 75 (+3 pts)</p>
                  <p>&bull; SBP &lt; 100 mmHg (+3 pts)</p>
                  <p>&bull; Heart Rate &gt; 100 BPM (+2 pts)</p>
                  <p>&bull; Killip II-IV presentation (+2 pts)</p>
                  <p>&bull; Anterior ST elevation / LBBB (+1 pt)</p>
                  <p>&bull; Time to treatment &gt; 4 hours (+1 pt)</p>
                  <div className="mt-3 p-3 rounded bg-slate-900 border border-purple-800 text-purple-300 font-bold">
                    Predicted 30-Day Mortality: {patient.timiScore >= 8 ? '35.9%' : patient.timiScore >= 6 ? '16.1%' : '7.3%'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROTOCOLS */}
        {activeTab === 'PROTOCOLS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  FDA 21 CFR Part 11 Interventional Cath Lab Audit Trail
                </h2>
                <p className="text-xs text-slate-400">Cryptographically signed records for acute coronary interventions.</p>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4" />
                Activate Protocol
              </button>
            </div>

            <div className="space-y-3">
              {signatureLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      {log.protocol}
                    </span>
                    <span className="font-mono text-slate-400">{log.time} &bull; Signer: {log.signer}</span>
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

      {/* EMERGENCY ACTIVATION MODAL */}
      {isProtocolModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-600 text-white">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Code STEMI Cath Lab Emergent Activation</h3>
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
                <label className="block text-slate-300 font-semibold mb-1">Select Reperfusion Protocol</label>
                <select
                  value={selectedProtocolToTrigger}
                  onChange={(e) => setSelectedProtocolToTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="CODE_STEMI_CATH_LAB">Code STEMI Emergent Primary PCI (&lt; 90m D2B Target)</option>
                  <option value="CARDIOGENIC_SHOCK_MCS">Cardiogenic Shock Mechanical Circulatory Support (Impella CP / ECMO)</option>
                  <option value="VERY_HIGH_RISK_NSTEMI">Very High-Risk NSTEMI Immediate Invasive Angiography (&lt; 2h)</option>
                  <option value="REFRACTORY_VF_ECPR">Refractory Ventricular Fibrillation / ECPR Cath Lab Activation</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Interventional Cardiologist Electronic Signature</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Clinical Indications &amp; Culprit Vessel Plan</label>
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
                  Under FDA 21 CFR Part 11 and ACC/AHA guidelines, this action executes an emergency interventional Cath Lab mobilization order.
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
                Sign &amp; Activate Cath Lab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
