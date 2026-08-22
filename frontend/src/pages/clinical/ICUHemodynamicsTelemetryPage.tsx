import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Activity,
  Heart,
  Zap,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  Download,
  Search,
  Filter,
  Flame,
  Radio,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  Droplets,
  Layers,
  Thermometer,
  Wind,
  PlusCircle,
  Eye,
  Sliders,
  Cpu,
  RefreshCw,
  X,
  Stethoscope,
  Sparkles,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * Clinical Types & Telemetry Models
 * ───────────────────────────────────────────────────────────── */

export interface HemodynamicReading {
  timestamp: string;
  heartRate: number; // bpm
  systolicBp: number; // mmHg
  diastolicBp: number; // mmHg
  map: number; // mmHg
  cvp: number; // mmHg (Central Venous Pressure)
  pcwp: number; // mmHg (Pulmonary Capillary Wedge Pressure)
  cardiacOutput: number; // L/min
  cardiacIndex: number; // L/min/m2
  cpo: number; // Watts (Cardiac Power Output = MAP * CO / 451)
  svr: number; // dyn·s/cm5
  strokeVolume: number; // mL
  lvswi: number; // g·m/m2
  svO2: number; // % (Mixed Venous O2)
  lactate: number; // mmol/L
  ph: number;
  paO2: number; // mmHg
  paCO2: number; // mmHg
  hco3: number; // mEq/L
  tempC: number;
  respRate: number;
  spO2: number;
}

export interface PatientProfile {
  id: string;
  bedNumber: string;
  mrn: string;
  fullName: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  bsa: number; // m2
  admissionDiagnosis: string;
  ward: string;
  acuity: "CARDIOGENIC_SHOCK" | "CRITICAL" | "GUARDED" | "STABLE" | "CODE_BLUE";
  mechanicalSupport: "NONE" | "IMPELLA_CP" | "VA_ECMO" | "VV_ECMO" | "IABP";
  vasopressorInotropicScore: number;
  kdigoStage: 0 | 1 | 2 | 3;
  qSofaScore: number;
  news2Score: number;
  vitals: HemodynamicReading;
  history: HemodynamicReading[];
  activeProtocols: EmergencyProtocolEvent[];
}

export interface EmergencyProtocolEvent {
  id: string;
  protocolType:
    | "CODE_RED_CARDIAC_ARREST"
    | "CODE_STEMI_CATH_LAB_ACTIVATION"
    | "SURVIVING_SEPSIS_HOUR_ONE_BUNDLE"
    | "MASSIVE_TRANSFUSION_PROTOCOL_MTP"
    | "CRRT_RENAL_REPLACEMENT_TRIGGER"
    | "ECMO_CANNULATION_ALERT";
  triggeredAt: string;
  triggeredBy: string;
  rationale: string;
  status: "ACTIVE" | "RESPONDING" | "STABILIZED" | "RESOLVED";
  signatureHash: string;
}

/* ─────────────────────────────────────────────────────────────
 * Initial Clinical Cohort Data
 * ───────────────────────────────────────────────────────────── */

const INITIAL_PATIENTS: PatientProfile[] = [
  {
    id: "PT-9401",
    bedNumber: "ICU-BED-01",
    mrn: "MRN-884210",
    fullName: "Elena Rostova",
    age: 64,
    gender: "FEMALE",
    bsa: 1.72,
    admissionDiagnosis: "Acute Anterolateral STEMI / Cardiogenic Shock",
    ward: "Cardiothoracic CCU",
    acuity: "CARDIOGENIC_SHOCK",
    mechanicalSupport: "IMPELLA_CP",
    vasopressorInotropicScore: 28.5,
    kdigoStage: 2,
    qSofaScore: 2,
    news2Score: 11,
    vitals: {
      timestamp: new Date().toLocaleTimeString(),
      heartRate: 118,
      systolicBp: 86,
      diastolicBp: 52,
      map: 63.3,
      cvp: 16,
      pcwp: 24,
      cardiacOutput: 3.1,
      cardiacIndex: 1.8,
      cpo: 0.43, // Critical CPO < 0.6W
      svr: 1220,
      strokeVolume: 26.2,
      lvswi: 14.1,
      svO2: 52.4,
      lactate: 4.8,
      ph: 7.28,
      paO2: 78,
      paCO2: 34,
      hco3: 16.2,
      tempC: 36.4,
      respRate: 26,
      spO2: 92,
    },
    history: [],
    activeProtocols: [
      {
        id: "PR-801",
        protocolType: "CODE_STEMI_CATH_LAB_ACTIVATION",
        triggeredAt: "10 mins ago",
        triggeredBy: "Dr. A. Vance (Interventional Cardiology)",
        rationale: "ST elevation in V1-V4, refractory hypotension CPO 0.43W, Impella CP P8 support active",
        status: "ACTIVE",
        signatureHash: "0x8a92fb10dc94ee71239ab761",
      },
    ],
  },
  {
    id: "PT-9402",
    bedNumber: "ICU-BED-02",
    mrn: "MRN-551092",
    fullName: "Marcus Holloway",
    age: 58,
    gender: "MALE",
    bsa: 2.05,
    admissionDiagnosis: "Severe Septic Shock secondary to Urosepsis",
    ward: "Cardiothoracic CCU",
    acuity: "CRITICAL",
    mechanicalSupport: "NONE",
    vasopressorInotropicScore: 18.0,
    kdigoStage: 3,
    qSofaScore: 3,
    news2Score: 12,
    vitals: {
      timestamp: new Date().toLocaleTimeString(),
      heartRate: 124,
      systolicBp: 82,
      diastolicBp: 44,
      map: 56.6,
      cvp: 6,
      pcwp: 11,
      cardiacOutput: 6.8,
      cardiacIndex: 3.32,
      cpo: 0.85,
      svr: 595, // Profound vasodilation
      strokeVolume: 54.8,
      lvswi: 34.2,
      svO2: 78.1,
      lactate: 5.4,
      ph: 7.22,
      paO2: 84,
      paCO2: 28,
      hco3: 12.8,
      tempC: 39.2,
      respRate: 28,
      spO2: 91,
    },
    history: [],
    activeProtocols: [
      {
        id: "PR-802",
        protocolType: "SURVIVING_SEPSIS_HOUR_ONE_BUNDLE",
        triggeredAt: "25 mins ago",
        triggeredBy: "Dr. K. Chen (Critical Care Intensivist)",
        rationale: "Lactate > 4 mmol/L, refractory vasodilation SVR 595, broad-spectrum IV carbapenem initiated",
        status: "ACTIVE",
        signatureHash: "0x3f71c4599ba012efc483a991",
      },
    ],
  },
  {
    id: "PT-9403",
    bedNumber: "ICU-BED-03",
    mrn: "MRN-330184",
    fullName: "Sophia Alvarez",
    age: 49,
    gender: "FEMALE",
    bsa: 1.68,
    admissionDiagnosis: "Post-Cardiotomy Shock / Biventricular Failure",
    ward: "Cardiothoracic CCU",
    acuity: "CRITICAL",
    mechanicalSupport: "VA_ECMO",
    vasopressorInotropicScore: 32.0,
    kdigoStage: 2,
    qSofaScore: 2,
    news2Score: 9,
    vitals: {
      timestamp: new Date().toLocaleTimeString(),
      heartRate: 88,
      systolicBp: 95,
      diastolicBp: 64,
      map: 74.3,
      cvp: 14,
      pcwp: 18,
      cardiacOutput: 4.2,
      cardiacIndex: 2.5,
      cpo: 0.69,
      svr: 1148,
      strokeVolume: 47.7,
      lvswi: 36.6,
      svO2: 66.8,
      lactate: 2.9,
      ph: 7.35,
      paO2: 140,
      paCO2: 38,
      hco3: 20.8,
      tempC: 36.8,
      respRate: 16,
      spO2: 99,
    },
    history: [],
    activeProtocols: [],
  },
  {
    id: "PT-9404",
    bedNumber: "ICU-BED-04",
    mrn: "MRN-772911",
    fullName: "Arthur Pendelton",
    age: 72,
    gender: "MALE",
    bsa: 1.94,
    admissionDiagnosis: "Acute Decompensated Heart Failure (Wet-Cold)",
    ward: "Cardiothoracic CCU",
    acuity: "GUARDED",
    mechanicalSupport: "NONE",
    vasopressorInotropicScore: 6.0,
    kdigoStage: 1,
    qSofaScore: 1,
    news2Score: 6,
    vitals: {
      timestamp: new Date().toLocaleTimeString(),
      heartRate: 92,
      systolicBp: 104,
      diastolicBp: 68,
      map: 80.0,
      cvp: 18,
      pcwp: 28, // Marked congestion
      cardiacOutput: 3.6,
      cardiacIndex: 1.86,
      cpo: 0.64,
      svr: 1377,
      strokeVolume: 39.1,
      lvswi: 27.6,
      svO2: 58.0,
      lactate: 2.1,
      ph: 7.38,
      paO2: 92,
      paCO2: 42,
      hco3: 24.5,
      tempC: 37.0,
      respRate: 20,
      spO2: 95,
    },
    history: [],
    activeProtocols: [],
  },
  {
    id: "PT-9405",
    bedNumber: "ICU-BED-05",
    mrn: "MRN-449102",
    fullName: "Devon Bradley",
    age: 41,
    gender: "MALE",
    bsa: 1.88,
    admissionDiagnosis: "Post-Op Orthotopic Heart Transplantation",
    ward: "Cardiothoracic CCU",
    acuity: "STABLE",
    mechanicalSupport: "NONE",
    vasopressorInotropicScore: 2.5,
    kdigoStage: 0,
    qSofaScore: 0,
    news2Score: 2,
    vitals: {
      timestamp: new Date().toLocaleTimeString(),
      heartRate: 96,
      systolicBp: 118,
      diastolicBp: 74,
      map: 88.6,
      cvp: 8,
      pcwp: 12,
      cardiacOutput: 5.4,
      cardiacIndex: 2.87,
      cpo: 1.06,
      svr: 1194,
      strokeVolume: 56.2,
      lvswi: 58.5,
      svO2: 74.2,
      lactate: 1.1,
      ph: 7.42,
      paO2: 105,
      paCO2: 39,
      hco3: 25.0,
      tempC: 37.1,
      respRate: 14,
      spO2: 99,
    },
    history: [],
    activeProtocols: [],
  },
];

/* ─────────────────────────────────────────────────────────────
 * Component Definition
 * ───────────────────────────────────────────────────────────── */

export default function ICUHemodynamicsTelemetryPage() {
  const [patients, setPatients] = useState<PatientProfile[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("PT-9401");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [acuityFilter, setAcuityFilter] = useState<string>("ALL");

  // Modals
  const [showProtocolModal, setShowProtocolModal] = useState<boolean>(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState<boolean>(false);
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);
  const [selectedProtocolType, setSelectedProtocolType] = useState<string>(
    "CODE_STEMI_CATH_LAB_ACTIVATION"
  );
  const [protocolRationale, setProtocolRationale] = useState<string>("");
  const [operatorId, setOperatorId] = useState<string>("STAFF-ICU-8821");

  // Hemodynamic Calculator State
  const [calcMap, setCalcMap] = useState<number>(65);
  const [calcCo, setCalcCo] = useState<number>(3.5);
  const [calcCvp, setCalcCvp] = useState<number>(12);
  const [calcPcwp, setCalcPcwp] = useState<number>(20);
  const [calcBsa, setCalcBsa] = useState<number>(1.8);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  /* ─────────────────────────────────────────────────────────────
   * Live Telemetry Streaming Loop
   * ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPatients((prevList) =>
        prevList.map((pt) => {
          // Dynamic physiological drift with jitter
          const hrJitter = Math.floor(Math.random() * 5) - 2;
          const sbpJitter = Math.floor(Math.random() * 5) - 2;
          const dbpJitter = Math.floor(Math.random() * 3) - 1;

          const newHr = Math.max(40, Math.min(180, pt.vitals.heartRate + hrJitter));
          const newSbp = Math.max(60, Math.min(220, pt.vitals.systolicBp + sbpJitter));
          const newDbp = Math.max(30, Math.min(130, pt.vitals.diastolicBp + dbpJitter));
          const newMap = Number(((2 * newDbp + newSbp) / 3).toFixed(1));

          const coDrift = (Math.random() * 0.2 - 0.1);
          const newCo = Number(Math.max(1.0, Math.min(12.0, pt.vitals.cardiacOutput + coDrift)).toFixed(2));
          const newCi = Number((newCo / pt.bsa).toFixed(2));
          const newCpo = Number(((newMap * newCo) / 451).toFixed(2));
          const newSvr = Math.round((80 * (newMap - pt.vitals.cvp)) / newCo);
          const newSv = Number(((newCo * 1000) / newHr).toFixed(1));
          const newSvi = Number((newSv / pt.bsa).toFixed(1));
          const newLvswi = Number((0.0136 * (newMap - pt.vitals.pcwp) * newSvi).toFixed(1));

          const updatedReading: HemodynamicReading = {
            ...pt.vitals,
            timestamp: new Date().toLocaleTimeString(),
            heartRate: newHr,
            systolicBp: newSbp,
            diastolicBp: newDbp,
            map: newMap,
            cardiacOutput: newCo,
            cardiacIndex: newCi,
            cpo: newCpo,
            svr: newSvr,
            strokeVolume: newSv,
            lvswi: newLvswi,
          };

          const newHistory = [...pt.history, updatedReading].slice(-30);

          return {
            ...pt,
            vitals: updatedReading,
            history: newHistory,
          };
        })
      );
    }, 2000 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, simulationSpeed]);

  /* ─────────────────────────────────────────────────────────────
   * Emergency Protocol Trigger Handler
   * ───────────────────────────────────────────────────────────── */

  const handleTriggerProtocol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    const signature = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const newProtocol: EmergencyProtocolEvent = {
      id: "PR-" + Math.floor(1000 + Math.random() * 9000),
      protocolType: selectedProtocolType as any,
      triggeredAt: "Just now",
      triggeredBy: operatorId + " (Attending Physician)",
      rationale: protocolRationale || "Immediate hemodynamic resuscitation required.",
      status: "ACTIVE",
      signatureHash: signature,
    };

    setPatients((prev) =>
      prev.map((pt) => {
        if (pt.id === selectedPatient.id) {
          return {
            ...pt,
            acuity:
              selectedProtocolType === "CODE_RED_CARDIAC_ARREST"
                ? "CODE_BLUE"
                : selectedProtocolType === "CODE_STEMI_CATH_LAB_ACTIVATION"
                ? "CARDIOGENIC_SHOCK"
                : "CRITICAL",
            activeProtocols: [newProtocol, ...pt.activeProtocols],
          };
        }
        return pt;
      })
    );

    setShowProtocolModal(false);
    setProtocolRationale("");
  };

  /* ─────────────────────────────────────────────────────────────
   * CSV Export Handler
   * ───────────────────────────────────────────────────────────── */

  const handleExportCSV = () => {
    const headers = [
      "Patient ID",
      "MRN",
      "Name",
      "Bed",
      "Acuity",
      "HR (bpm)",
      "BP (mmHg)",
      "MAP (mmHg)",
      "CO (L/min)",
      "CI (L/min/m2)",
      "CPO (W)",
      "SVR (dyn.s/cm5)",
      "SvO2 (%)",
      "Lactate (mmol/L)",
      "KDIGO Stage",
      "qSOFA",
      "NEWS2",
      "Timestamp",
    ];

    const rows = patients.map((p) => [
      p.id,
      p.mrn,
      p.fullName,
      p.bedNumber,
      p.acuity,
      p.vitals.heartRate,
      p.vitals.systolicBp + "/" + p.vitals.diastolicBp,
      p.vitals.map,
      p.vitals.cardiacOutput,
      p.vitals.cardiacIndex,
      p.vitals.cpo,
      p.vitals.svr,
      p.vitals.svO2,
      p.vitals.lactate,
      p.kdigoStage,
      p.qSofaScore,
      p.news2Score,
      p.vitals.timestamp,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ICU_Hemodynamics_Telemetry_Export_" + Date.now() + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ─────────────────────────────────────────────────────────────
   * Filtered Patients
   * ───────────────────────────────────────────────────────────── */

  const filteredPatients = useMemo(() => {
    return patients.filter((pt) => {
      const matchesSearch =
        pt.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pt.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pt.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pt.admissionDiagnosis.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAcuity =
        acuityFilter === "ALL" || pt.acuity === acuityFilter;

      return matchesSearch && matchesAcuity;
    });
  }, [patients, searchQuery, acuityFilter]);

  // Derived Calculator values
  const derivedCi = Number((calcCo / calcBsa).toFixed(2));
  const derivedCpo = Number(((calcMap * calcCo) / 451).toFixed(2));
  const derivedSvr = Math.round((80 * (calcMap - calcCvp)) / calcCo);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6 font-sans">
      {/* ────────────────── Header & Telemetry Control Deck ────────────────── */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl shadow-lg shadow-rose-500/10">
              <Activity className="w-7 h-7 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Cardiovascular ICU Hemodynamics & Telemetry Command Station
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Radio className="w-3 h-3 mr-1 animate-ping" /> LIVE SURVEILLANCE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                High-Assurance Clinical Decision Support • ACC/AHA Shock Protocols • KDIGO AKI • qSOFA / NEWS2 • FDA 21 CFR Part 11
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition " + (isPlaying ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40")}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? "Pause Stream" : "Resume Stream"}
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <div className="flex items-center gap-1 px-1">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSimulationSpeed(speed)}
                  className={"px-2 py-1 text-xs rounded transition " + (simulationSpeed === speed ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200")}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowCalculatorModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Hemodynamic Calc
          </button>

          <button
            onClick={() => setShowFhirModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            HL7 FHIR R4 Bundle
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Telemetry
          </button>
        </div>
      </header>

      {/* ────────────────── KPI Overview Bar ────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-slate-400 flex items-center justify-between">
            Active ICU Beds
            <Layers className="w-4 h-4 text-cyan-400" />
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{patients.length}</span>
            <span className="text-xs text-emerald-400">100% Monitored</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-rose-950/50 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-rose-400 flex items-center justify-between">
            Cardiogenic Shock
            <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-300">
              {patients.filter((p) => p.acuity === "CARDIOGENIC_SHOCK").length}
            </span>
            <span className="text-xs text-rose-400 font-mono">CPO &lt; 0.6W</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-amber-950/50 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-amber-400 flex items-center justify-between">
            Severe Sepsis Alert
            <Flame className="w-4 h-4 text-amber-500" />
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300">
              {patients.filter((p) => p.qSofaScore >= 2).length}
            </span>
            <span className="text-xs text-amber-400">qSOFA ≥ 2</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-slate-400 flex items-center justify-between">
            Mechanical Support
            <Cpu className="w-4 h-4 text-violet-400" />
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-violet-300">
              {patients.filter((p) => p.mechanicalSupport !== "NONE").length}
            </span>
            <span className="text-xs text-slate-400">Impella/ECMO</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-slate-400 flex items-center justify-between">
            KDIGO Stage 2/3 AKI
            <Droplets className="w-4 h-4 text-blue-400" />
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-300">
              {patients.filter((p) => p.kdigoStage >= 2).length}
            </span>
            <span className="text-xs text-blue-400">CRRT Watch</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <span className="text-xs font-medium text-slate-400 flex items-center justify-between">
            Emergency Protocols
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300">
              {patients.reduce((acc, p) => acc + p.activeProtocols.length, 0)}
            </span>
            <span className="text-xs text-emerald-400">Active</span>
          </div>
        </div>
      </div>

      {/* ────────────────── Main Workspace Layout ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bed Matrix & Patient Selection (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-rose-400" />
                ICU Ward Surveillance Matrix
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {filteredPatients.length} beds
              </span>
            </div>

            {/* Search & Acuity Filter */}
            <div className="flex flex-col gap-2 mb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search bed, MRN, patient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {["ALL", "CARDIOGENIC_SHOCK", "CRITICAL", "GUARDED", "STABLE"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAcuityFilter(filter)}
                    className={"px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase whitespace-nowrap transition " + (acuityFilter === filter ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80")}
                  >
                    {filter.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Bed Cards */}
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredPatients.map((pt) => {
                const isSelected = pt.id === selectedPatient.id;
                const isShock = pt.acuity === "CARDIOGENIC_SHOCK";
                const isCrit = pt.acuity === "CRITICAL";

                return (
                  <div
                    key={pt.id}
                    onClick={() => setSelectedPatientId(pt.id)}
                    className={"p-3.5 rounded-xl border cursor-pointer transition relative " + (isSelected ? "bg-slate-850 border-cyan-500/70 shadow-md shadow-cyan-500/10" : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900")}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{pt.bedNumber}</span>
                          <span className={"px-2 py-0.5 text-[10px] font-bold rounded-full " + (isShock ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse" : isCrit ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40")}>
                            {pt.acuity.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-200 mt-1">{pt.fullName}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{pt.admissionDiagnosis}</div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xs text-rose-400 font-bold">HR: {pt.vitals.heartRate}</div>
                        <div className="text-xs text-cyan-300 font-bold">MAP: {pt.vitals.map}</div>
                        <div className="text-[10px] text-slate-400">CI: {pt.vitals.cardiacIndex}</div>
                      </div>
                    </div>

                    {/* Vitals Ribbon */}
                    <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] font-mono">
                      <div className="bg-slate-900 px-2 py-1 rounded">
                        <span className="text-slate-500 block">CPO</span>
                        <span className={pt.vitals.cpo < 0.6 ? "text-rose-400 font-bold" : "text-slate-200"}>
                          {pt.vitals.cpo}W
                        </span>
                      </div>
                      <div className="bg-slate-900 px-2 py-1 rounded">
                        <span className="text-slate-500 block">SVR</span>
                        <span className="text-slate-200">{pt.vitals.svr}</span>
                      </div>
                      <div className="bg-slate-900 px-2 py-1 rounded">
                        <span className="text-slate-500 block">Lactate</span>
                        <span className={pt.vitals.lactate > 2.0 ? "text-amber-400 font-bold" : "text-slate-200"}>
                          {pt.vitals.lactate}
                        </span>
                      </div>
                      <div className="bg-slate-900 px-2 py-1 rounded">
                        <span className="text-slate-500 block">NEWS2</span>
                        <span className={pt.news2Score >= 7 ? "text-rose-400 font-bold" : "text-slate-200"}>
                          {pt.news2Score}
                        </span>
                      </div>
                    </div>

                    {pt.activeProtocols.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>Protocol Active: {pt.activeProtocols[0].protocolType.replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Patient High-Assurance Telemetry Station (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Patient Profile Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedPatient.fullName}</h2>
                  <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 font-mono text-xs rounded border border-slate-700">
                    {selectedPatient.mrn}
                  </span>
                  <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 text-xs font-bold rounded-full border border-rose-500/40">
                    {selectedPatient.bedNumber}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                  <span>Age: {selectedPatient.age} yrs</span>
                  <span>Gender: {selectedPatient.gender}</span>
                  <span>BSA: {selectedPatient.bsa} m²</span>
                  <span>Ward: {selectedPatient.ward}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProtocolModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-rose-600/30 animate-pulse"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Trigger Emergency Protocol
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-300 flex items-center gap-2">
              <span className="font-semibold text-slate-400">Diagnosis:</span>
              <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 font-medium">
                {selectedPatient.admissionDiagnosis}
              </span>
              <span className="ml-auto font-mono text-xs text-slate-400">
                Support: <strong className="text-violet-400">{selectedPatient.mechanicalSupport}</strong> | VIS Score: <strong className="text-amber-400">{selectedPatient.vasopressorInotropicScore}</strong>
              </span>
            </div>
          </div>

          {/* High-Assurance Telemetry Gauges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Heart Rate */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Heart Rate</span>
                <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-white">
                  {selectedPatient.vitals.heartRate}
                </span>
                <span className="text-xs font-mono text-slate-500">bpm</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Target: 60-100</span>
                <span className={selectedPatient.vitals.heartRate > 100 ? "text-amber-400" : "text-emerald-400"}>
                  {selectedPatient.vitals.heartRate > 100 ? "Sinus Tach" : "Normal"}
                </span>
              </div>
            </div>

            {/* Blood Pressure & MAP */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Arterial BP (MAP)</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-white">
                  {selectedPatient.vitals.systolicBp}/{selectedPatient.vitals.diastolicBp}
                </span>
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  ({selectedPatient.vitals.map})
                </span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between">
                <span className="text-slate-400">MAP Target ≥ 65</span>
                <span className={selectedPatient.vitals.map < 65 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {selectedPatient.vitals.map < 65 ? "Hypotensive" : "Perfusion OK"}
                </span>
              </div>
            </div>

            {/* Cardiac Output & Cardiac Index */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Cardiac Output (CI)</span>
                <Droplets className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-white">
                  {selectedPatient.vitals.cardiacOutput}
                </span>
                <span className="text-xs font-mono text-blue-400 font-bold">
                  CI: {selectedPatient.vitals.cardiacIndex}
                </span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                <span>CI Target ≥ 2.2</span>
                <span className={selectedPatient.vitals.cardiacIndex < 2.2 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {selectedPatient.vitals.cardiacIndex < 2.2 ? "Low Output" : "Adequate"}
                </span>
              </div>
            </div>

            {/* Cardiac Power Output (CPO) */}
            <div className="bg-slate-900/90 border border-rose-950/60 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
                <span>Cardiac Power (CPO)</span>
                <Zap className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={"text-3xl font-bold font-mono " + (selectedPatient.vitals.cpo < 0.6 ? "text-rose-400 animate-pulse" : "text-white")}>
                  {selectedPatient.vitals.cpo}
                </span>
                <span className="text-xs font-mono text-slate-500">Watts</span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between">
                <span className="text-slate-400">Shock Thresh: 0.60W</span>
                <span className={selectedPatient.vitals.cpo < 0.6 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {selectedPatient.vitals.cpo < 0.6 ? "SHOCK CRITICAL" : "Compensated"}
                </span>
              </div>
            </div>

            {/* Systemic Vascular Resistance (SVR) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>SVR</span>
                <Wind className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-white">
                  {selectedPatient.vitals.svr}
                </span>
                <span className="text-[10px] font-mono text-slate-500">dyn·s/cm⁵</span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                <span>Normal: 800-1200</span>
                <span className={selectedPatient.vitals.svr < 800 ? "text-amber-400 font-bold" : selectedPatient.vitals.svr > 1400 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {selectedPatient.vitals.svr < 800 ? "Vasodilatory" : selectedPatient.vitals.svr > 1400 ? "Vasoconstricted" : "Normal"}
                </span>
              </div>
            </div>

            {/* Mixed Venous O2 (SvO2) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>SvO2 (Mixed Venous)</span>
                <Droplets className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-white">
                  {selectedPatient.vitals.svO2}%
                </span>
                <span className="text-xs font-mono text-slate-500">PA Catheter</span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                <span>Normal: 65-75%</span>
                <span className={selectedPatient.vitals.svO2 < 65 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {selectedPatient.vitals.svO2 < 65 ? "O2 Extraction High" : "Satisfactory"}
                </span>
              </div>
            </div>

            {/* Arterial Lactate & pH */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Lactate & pH</span>
                <Thermometer className="w-4 h-4 text-violet-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-amber-300">
                  {selectedPatient.vitals.lactate}
                </span>
                <span className="text-xs font-mono text-violet-400 font-bold">
                  pH {selectedPatient.vitals.ph}
                </span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                <span>Lactate &lt; 2.0 mmol/L</span>
                <span className={selectedPatient.vitals.lactate > 2.0 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {selectedPatient.vitals.lactate > 2.0 ? "Tissue Hypoperfusion" : "Cleared"}
                </span>
              </div>
            </div>

            {/* Respiratory & SpO2 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>SpO2 / Resp Rate</span>
                <Wind className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-cyan-300">
                  {selectedPatient.vitals.spO2}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  RR: {selectedPatient.vitals.respRate}
                </span>
              </div>
              <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                <span>Target ≥ 94%</span>
                <span className="text-emerald-400 font-medium">Ventilator SIMV</span>
              </div>
            </div>
          </div>

          {/* Deep-Dive Hemodynamic Diagnostic Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cardiac Filling Pressures & Stroke Work */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                Cardiac Filling Pressures & Workload
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Central Venous Pressure (CVP)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.cvp} mmHg</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Pulmonary Wedge Pressure (PCWP)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.pcwp} mmHg</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Stroke Volume (SV)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.strokeVolume} mL</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">LV Stroke Work Index (LVSWI)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.lvswi} g·m/m²</span>
                </div>
              </div>
            </div>

            {/* Arterial Blood Gas (ABG) Panel */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Arterial Blood Gas (ABG) & Acid-Base
              </h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Arterial pH</span>
                  <span className={selectedPatient.vitals.ph < 7.35 ? "font-bold text-rose-400" : "font-bold text-emerald-400"}>
                    {selectedPatient.vitals.ph}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">PaO2 (Oxygen Tension)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.paO2} mmHg</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">PaCO2 (Carbon Dioxide)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.paCO2} mmHg</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Bicarbonate (HCO3)</span>
                  <span className="font-bold text-white">{selectedPatient.vitals.hco3} mEq/L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Emergency Protocols & Audit Ledger */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                FDA 21 CFR Part 11 Protocol Audit Ledger
              </h3>
              <span className="text-xs text-slate-400">
                {selectedPatient.activeProtocols.length} active events
              </span>
            </div>

            {selectedPatient.activeProtocols.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80">
                No active emergency resuscitation protocols for this bed. Hemodynamics stable within target thresholds.
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedPatient.activeProtocols.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-3 bg-slate-950 border border-amber-500/30 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">
                          {pr.protocolType.replace(/_/g, " ")}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/40">
                          {pr.status}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">{pr.triggeredAt}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] mt-1">{pr.rationale}</p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Signer: <strong className="text-slate-200">{pr.triggeredBy}</strong> | Signature: <code className="text-cyan-400 font-mono">{pr.signatureHash}</code>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPatients((prev) =>
                            prev.map((pt) =>
                              pt.id === selectedPatient.id
                                ? {
                                    ...pt,
                                    activeProtocols: pt.activeProtocols.map((p) =>
                                      p.id === pr.id ? { ...p, status: "STABILIZED" } : p
                                    ),
                                  }
                                : pt
                            )
                          );
                        }}
                        className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-xs font-medium transition"
                      >
                        Mark Stabilized
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── Emergency Protocol Trigger Modal ────────────────── */}
      {showProtocolModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <h3>Execute Critical Resuscitation Protocol</h3>
              </div>
              <button
                onClick={() => setShowProtocolModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerProtocol} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Patient / Bed</label>
                <input
                  type="text"
                  disabled
                  value={selectedPatient.fullName + " (" + selectedPatient.bedNumber + " • " + selectedPatient.mrn + ")"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Protocol Type</label>
                <select
                  value={selectedProtocolType}
                  onChange={(e) => setSelectedProtocolType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="CODE_STEMI_CATH_LAB_ACTIVATION">🚨 Code STEMI - Emergency Cath Lab Activation</option>
                  <option value="CODE_RED_CARDIAC_ARREST">⚡ Code Red - Cardiopulmonary Arrest / ACLS</option>
                  <option value="SURVIVING_SEPSIS_HOUR_ONE_BUNDLE">🧪 Surviving Sepsis Campaign Hour-1 Bundle</option>
                  <option value="MASSIVE_TRANSFUSION_PROTOCOL_MTP">🩸 Massive Transfusion Protocol (MTP 1:1:1)</option>
                  <option value="CRRT_RENAL_REPLACEMENT_TRIGGER">🔄 Continuous Renal Replacement (CRRT) Staging</option>
                  <option value="ECMO_CANNULATION_ALERT">🫀 VA-ECMO / E-CPR Cannulation Protocol</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Clinical Rationale & Orders</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify hemodynamic indications, lactate level, vasopressor escalation rationale..."
                  value={protocolRationale}
                  onChange={(e) => setProtocolRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  FDA 21 CFR Part 11 Electronic Signature ID
                </label>
                <input
                  type="text"
                  required
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProtocolModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow-lg shadow-rose-600/30"
                >
                  Authorize & Trigger Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── Hemodynamic Calculator Modal ────────────────── */}
      {showCalculatorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Sliders className="w-5 h-5" />
                <h3>Bedside Hemodynamic & Shock Diagnostic Calculator</h3>
              </div>
              <button
                onClick={() => setShowCalculatorModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Mean Arterial Pressure (MAP, mmHg)</label>
                  <input
                    type="number"
                    value={calcMap}
                    onChange={(e) => setCalcMap(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Cardiac Output (CO, L/min)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcCo}
                    onChange={(e) => setCalcCo(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Central Venous Pressure (CVP, mmHg)</label>
                  <input
                    type="number"
                    value={calcCvp}
                    onChange={(e) => setCalcCvp(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Body Surface Area (BSA, m²)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={calcBsa}
                    onChange={(e) => setCalcBsa(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-white"
                  />
                </div>
              </div>

              {/* Calculated Outputs */}
              <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/30 space-y-2 font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Cardiac Index (CI = CO / BSA):</span>
                  <strong className={derivedCi < 2.2 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                    {derivedCi} L/min/m²
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Cardiac Power Output (CPO = MAP × CO / 451):</span>
                  <strong className={derivedCpo < 0.6 ? "text-rose-400 font-bold text-sm" : "text-cyan-300 font-bold text-sm"}>
                    {derivedCpo} Watts {derivedCpo < 0.6 ? "(CARDIOGENIC SHOCK)" : "(COMPENSATED)"}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Systemic Vascular Resistance (SVR):</span>
                  <strong className="text-amber-300 font-bold">{derivedSvr} dyn·s/cm⁵</strong>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed">
                * Based on ACC/AHA shock indices. CPO &lt; 0.60W identifies patients at high risk of mortality in cardiogenic shock who may benefit from early mechanical circulatory support (Impella/ECMO).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── HL7 FHIR R4 Bundle Modal ────────────────── */}
      {showFhirModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <FileText className="w-5 h-5" />
                <h3>HL7 FHIR R4 Interoperability Bundle Stream</h3>
              </div>
              <button
                onClick={() => setShowFhirModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-96">
              <pre className="text-[11px] font-mono text-cyan-300 leading-tight">
                {JSON.stringify(
                  {
                    resourceType: "Bundle",
                    type: "collection",
                    timestamp: new Date().toISOString(),
                    patient: {
                      id: selectedPatient.id,
                      mrn: selectedPatient.mrn,
                      name: selectedPatient.fullName,
                      gender: selectedPatient.gender.toLowerCase(),
                      ward: selectedPatient.ward,
                    },
                    observation: {
                      status: "final",
                      category: "vital-signs",
                      loincCode: "8867-4",
                      heartRate: selectedPatient.vitals.heartRate,
                      bloodPressure: selectedPatient.vitals.systolicBp + "/" + selectedPatient.vitals.diastolicBp,
                      map: selectedPatient.vitals.map,
                      cardiacOutput: selectedPatient.vitals.cardiacOutput,
                      cardiacPowerOutput: selectedPatient.vitals.cpo,
                      systemicVascularResistance: selectedPatient.vitals.svr,
                      mixedVenousSat: selectedPatient.vitals.svO2,
                      arterialLactate: selectedPatient.vitals.lactate,
                    },
                    clinicalDecisionSupport: {
                      qSofaScore: selectedPatient.qSofaScore,
                      news2Score: selectedPatient.news2Score,
                      kdigoStage: selectedPatient.kdigoStage,
                      acuity: selectedPatient.acuity,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
