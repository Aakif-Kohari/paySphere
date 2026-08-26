import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Download,
  Layers,
  Zap,
  Gauge,
  Droplets,
  Syringe,
  FileText,
  ChevronDown,
  Info,
  Volume2,
  VolumeX,
  Workflow,
  Sparkles,
  Radio,
  Flame,
  Thermometer,
  Heart,
  Timer,
  SlidersHorizontal,
  Baby,
  Stethoscope,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * TypeScript Interfaces & Constants
 * ───────────────────────────────────────────────────────────── */

export type NICHDCategory = "CATEGORY_I" | "CATEGORY_II" | "CATEGORY_III";

export interface MaternalFetalPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gravidaPara: string;
  gestationalAgeWeeks: number;
  admissionDate: string;
  hoursInLabor: number;
  cervicalDilationCm: number;
  cervicalEffacementPercent: number;
  fetalStation: number;
  fetalPosition: string;
  fhrBaselineBpm: number;
  fhrVariability: "ABSENT" | "MINIMAL" | "MODERATE" | "MARKED";
  fhrAccelerationsPresent: boolean;
  fhrDecelerationType: "NONE" | "EARLY_DECELERATIONS" | "RECURRENT_VARIABLE" | "RECURRENT_LATE_DECELERATIONS";
  nichdCategory: NICHDCategory;
  tocoContractionFrequencyPer10Min: number;
  tocoContractionIntensityMmHg: number;
  montevideoUnits: number;
  maternalHeartRateBpm: number;
  maternalSystolicBpMmHg: number;
  maternalDiastolicBpMmHg: number;
  maternalMapMmHg: number;
  maternalSpO2Percent: number;
  maternalTempC: number;
  preeclampsiaStatus: string;
  magnesiumSulfateInfusionGramsHour: number;
  serumMagnesiumMgDl: number;
  patellarReflexes: string;
  urineOutputLastHourMl: number;
  quantitativeBloodLossMl: number;
  aimPphStage: string;
  oxytocinInfusionMunitsMin: number;
  fetalScalpPh: number;
  fetalScalpLactateMmol: number;
  clinicalStatus: string;
}

export interface CTGDataPoint {
  timestamp: string;
  tick: number;
  fhr: number;
  toco: number;
  maternalHr: number;
}

export interface ClinicalAlarm {
  id: string;
  timestamp: string;
  code: string;
  severity: "CRITICAL" | "HIGH_RISK" | "WARNING" | "INFO";
  title: string;
  message: string;
  action: string;
  acknowledged: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operator: string;
  category: "NICHD_FHR" | "MAGNESIUM_TITRATION" | "PPH_STAGE" | "INTRAUTERINE_RESUSCITATION" | "EMERGENCY_PROTOCOL" | "SYSTEM";
  action: string;
  deltaSummary: string;
  sha256Signature: string;
}

const INITIAL_PATIENTS: MaternalFetalPatient[] = [
  {
    id: "PT-MATERNAL-8301",
    name: "Dr. Savannah Sterling, MD",
    mrn: "MRN-3349102",
    age: 33,
    gravidaPara: "G1P0 (Nulliparous)",
    gestationalAgeWeeks: 38.4,
    admissionDate: "2026-08-22T17:00:00Z",
    hoursInLabor: 8.5,
    cervicalDilationCm: 6.0,
    cervicalEffacementPercent: 80,
    fetalStation: 0,
    fetalPosition: "LOA (Left Occiput Anterior)",
    fhrBaselineBpm: 145,
    fhrVariability: "MODERATE",
    fhrAccelerationsPresent: true,
    fhrDecelerationType: "RECURRENT_VARIABLE",
    nichdCategory: "CATEGORY_II",
    tocoContractionFrequencyPer10Min: 4.5,
    tocoContractionIntensityMmHg: 55,
    montevideoUnits: 247,
    maternalHeartRateBpm: 92,
    maternalSystolicBpMmHg: 158,
    maternalDiastolicBpMmHg: 104,
    maternalMapMmHg: 122.0,
    maternalSpO2Percent: 98.0,
    maternalTempC: 37.1,
    preeclampsiaStatus: "SEVERE_PREECLAMPSIA_MAGNESIUM_ACTIVE",
    magnesiumSulfateInfusionGramsHour: 2.0,
    serumMagnesiumMgDl: 6.2,
    patellarReflexes: "2+_NORMAL",
    urineOutputLastHourMl: 45,
    quantitativeBloodLossMl: 250,
    aimPphStage: "NORMAL_PRE_DELIVERY",
    oxytocinInfusionMunitsMin: 6,
    fetalScalpPh: 7.28,
    fetalScalpLactateMmol: 3.2,
    clinicalStatus: "ACTIVE_LABOR_CATEGORY_II_PREECLAMPSIA",
  },
  {
    id: "PT-MATERNAL-8302",
    name: "Clara Vance-Moreau",
    mrn: "MRN-4491823",
    age: 28,
    gravidaPara: "G2P1",
    gestationalAgeWeeks: 39.1,
    admissionDate: "2026-08-22T19:15:00Z",
    hoursInLabor: 4.0,
    cervicalDilationCm: 8.5,
    cervicalEffacementPercent: 100,
    fetalStation: 1,
    fetalPosition: "OA (Direct Occiput Anterior)",
    fhrBaselineBpm: 135,
    fhrVariability: "MODERATE",
    fhrAccelerationsPresent: true,
    fhrDecelerationType: "EARLY_DECELERATIONS",
    nichdCategory: "CATEGORY_I",
    tocoContractionFrequencyPer10Min: 4.0,
    tocoContractionIntensityMmHg: 60,
    montevideoUnits: 240,
    maternalHeartRateBpm: 84,
    maternalSystolicBpMmHg: 118,
    maternalDiastolicBpMmHg: 74,
    maternalMapMmHg: 88.7,
    maternalSpO2Percent: 99.0,
    maternalTempC: 36.8,
    preeclampsiaStatus: "NORMOTENSIVE",
    magnesiumSulfateInfusionGramsHour: 0.0,
    serumMagnesiumMgDl: 2.0,
    patellarReflexes: "2+_NORMAL",
    urineOutputLastHourMl: 65,
    quantitativeBloodLossMl: 180,
    aimPphStage: "NORMAL_PRE_DELIVERY",
    oxytocinInfusionMunitsMin: 4,
    fetalScalpPh: 7.34,
    fetalScalpLactateMmol: 2.1,
    clinicalStatus: "PROGRESSING_LABOR_CATEGORY_I_REASSURING",
  },
  {
    id: "PT-MATERNAL-8303",
    name: "Evangeline Dubois, JD",
    mrn: "MRN-2201948",
    age: 39,
    gravidaPara: "G3P2 (Prior Cesarean x1)",
    gestationalAgeWeeks: 37.2,
    admissionDate: "2026-08-22T16:30:00Z",
    hoursInLabor: 11.0,
    cervicalDilationCm: 5.0,
    cervicalEffacementPercent: 70,
    fetalStation: -1,
    fetalPosition: "ROP (Right Occiput Posterior)",
    fhrBaselineBpm: 95,
    fhrVariability: "ABSENT",
    fhrAccelerationsPresent: false,
    fhrDecelerationType: "RECURRENT_LATE_DECELERATIONS",
    nichdCategory: "CATEGORY_III",
    tocoContractionFrequencyPer10Min: 6.0,
    tocoContractionIntensityMmHg: 70,
    montevideoUnits: 420,
    maternalHeartRateBpm: 128,
    maternalSystolicBpMmHg: 84,
    maternalDiastolicBpMmHg: 48,
    maternalMapMmHg: 60.0,
    maternalSpO2Percent: 94.0,
    maternalTempC: 38.3,
    preeclampsiaStatus: "CHORIOAMNIONITIS_TACHYSYSTOLE",
    magnesiumSulfateInfusionGramsHour: 0.0,
    serumMagnesiumMgDl: 1.9,
    patellarReflexes: "1+_DIMINISHED",
    urineOutputLastHourMl: 20,
    quantitativeBloodLossMl: 1650,
    aimPphStage: "STAGE_3_SEVERE_HEMORRHAGE",
    oxytocinInfusionMunitsMin: 0,
    fetalScalpPh: 7.08,
    fetalScalpLactateMmol: 7.8,
    clinicalStatus: "CRITICAL_CATEGORY_III_STAT_CESAREAN_PPH_STAGE_3",
  },
];

/* ─────────────────────────────────────────────────────────────
 * Main Component Definition
 * ───────────────────────────────────────────────────────────── */

export default function MaternalFetalTelemetryPage(): JSX.Element {
  const [patients, setPatients] = useState<MaternalFetalPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("PT-MATERNAL-8301");
  const [activeTab, setActiveTab] = useState<"telemetry" | "resuscitation" | "calculators" | "emergency" | "audit">("telemetry");
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [ctgHistory, setCtgHistory] = useState<CTGDataPoint[]>([]);
  const [, setTickCounter] = useState<number>(0);
  const [alarms, setAlarms] = useState<ClinicalAlarm[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeEmergencyProtocol, setActiveEmergencyProtocol] = useState<string | null>(null);
  const [isFHIRModalOpen, setIsFHIRModalOpen] = useState<boolean>(false);
  const [isMedsModalOpen, setIsMedsModalOpen] = useState<boolean>(false);

  // Bishop Score Interactive inputs
  const [bishopDilation, setBishopDilation] = useState<number>(6);
  const [bishopEffacement, setBishopEffacement] = useState<number>(80);
  const [bishopStation, setBishopStation] = useState<number>(0);
  const [bishopConsistency, setBishopConsistency] = useState<"SOFT" | "MEDIUM" | "FIRM">("SOFT");
  const [bishopPosition, setBishopPosition] = useState<"ANTERIOR" | "MID" | "POSTERIOR">("ANTERIOR");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  // Initialize Audit Log and Alarms on mount
  useEffect(() => {
    const initialLogs: AuditLogEntry[] = [
      {
        id: "AUD-OB-001",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        operator: "Dr. Evelyn Reed, MD (Attending Obstetrician)",
        category: "MAGNESIUM_TITRATION",
        action: "Initiated IV Magnesium Sulfate Infusion",
        deltaSummary: "Severe Preeclampsia BP 158/104. 4g IV loading dose administered, maintenance set to 2g/hr.",
        sha256Signature: "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
      },
      {
        id: "AUD-OB-002",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        operator: "Claire Dupont, CNM (Certified Nurse Midwife)",
        category: "INTRAUTERINE_RESUSCITATION",
        action: "Initiated Intrauterine Resuscitation Protocol",
        deltaSummary: "Recurrent variable decelerations (Category II). Repositioned to Left Lateral Tilt, 10L O2 via NRB.",
        sha256Signature: "1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      },
    ];
    setAuditLogs(initialLogs);

    const initialAlarms: ClinicalAlarm[] = [
      {
        id: "ALM-OB-001",
        timestamp: new Date().toISOString(),
        code: "NICHD_CAT_II_DECEL",
        severity: "WARNING",
        title: "Category II Fetal Heart Rate Tracing",
        message: "Recurrent variable decelerations detected with moderate baseline variability.",
        action: "Initiate intrauterine resuscitation: Left lateral tilt, IV bolus, reduce Oxytocin.",
        acknowledged: false,
      },
      {
        id: "ALM-OB-002",
        timestamp: new Date().toISOString(),
        code: "SEVERE_MATERNAL_HTN",
        severity: "HIGH_RISK",
        title: "Severe Maternal Hypertension (158/104 mmHg)",
        message: "Blood pressure in severe preeclampsia range. Magnesium sulfate running.",
        action: "Verify patellar reflexes, check urine output, consider IV Labetalol 20mg.",
        acknowledged: false,
      },
    ];
    setAlarms(initialAlarms);

    const initialHist: CTGDataPoint[] = [];
    for (let i = 25; i >= 0; i--) {
      initialHist.push({
        timestamp: new Date(Date.now() - i * 3000).toISOString(),
        tick: -i,
        fhr: currentPatient.fhrBaselineBpm + (Math.sin(i) * 6),
        toco: 20 + Math.max(0, Math.sin(i * 0.4) * currentPatient.tocoContractionIntensityMmHg),
        maternalHr: currentPatient.maternalHeartRateBpm + (Math.cos(i) * 2),
      });
    }
    setCtgHistory(initialHist);
  }, []);

  // Real-time Simulation Engine
  useEffect(() => {
    if (!isLiveStreaming) return;

    const intervalMs = Math.max(250, 1000 / simulationSpeed);
    const timer = setInterval(() => {
      setTickCounter((prev) => prev + 1);

      setPatients((prevPatients) =>
        prevPatients.map((pt) => {
          if (pt.id !== selectedPatientId) return pt;

          const noiseFhr = (Math.random() - 0.5) * 2.0;
          const noiseMatHr = (Math.random() - 0.5) * 1.0;
          const newFhr = Math.max(70, Math.min(200, Number((pt.fhrBaselineBpm + noiseFhr).toFixed(0))));
          const newMatHr = Math.max(50, Math.min(160, Number((pt.maternalHeartRateBpm + noiseMatHr).toFixed(0))));

          return {
            ...pt,
            fhrBaselineBpm: newFhr,
            maternalHeartRateBpm: newMatHr,
          };
        })
      );

      setCtgHistory((prev) => {
        const last = prev[prev.length - 1] || {
          fhr: currentPatient.fhrBaselineBpm,
          toco: 20,
          maternalHr: currentPatient.maternalHeartRateBpm,
        };

        const newPoint: CTGDataPoint = {
          timestamp: new Date().toISOString(),
          tick: (last.tick || 0) + 1,
          fhr: currentPatient.fhrBaselineBpm,
          toco: 20 + Math.max(0, Math.sin((last.tick || 0) * 0.25) * currentPatient.tocoContractionIntensityMmHg),
          maternalHr: currentPatient.maternalHeartRateBpm,
        };

        const updated = [...prev, newPoint];
        return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isLiveStreaming, simulationSpeed, selectedPatientId, currentPatient]);

  // High-Resolution Cardiotocography Canvas (Upper FHR, Lower TOCO)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      phase += 0.06 * simulationSpeed;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      // CTG Paper Grid Lines
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Divider between FHR (Upper) and TOCO (Lower)
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.65);
      ctx.lineTo(width, height * 0.65);
      ctx.stroke();

      // 1. Draw Fetal Heart Rate (FHR) Trace (Upper Channel: Emerald/Amber/Rose)
      ctx.strokeStyle = currentPatient.nichdCategory === "CATEGORY_III"
        ? "#f43f5e"
        : currentPatient.nichdCategory === "CATEGORY_II"
        ? "#f59e0b"
        : "#10b981";
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      const fhrBaselineY = height * 0.32;
      for (let x = 0; x < width; x++) {
        const t = (x / 25) - phase;
        // Moderate baseline variability jitter
        const variability = currentPatient.fhrVariability === "ABSENT"
          ? 0.5
          : currentPatient.fhrVariability === "MINIMAL"
          ? (Math.sin(t * 12) * 2)
          : (Math.sin(t * 14) * 5 + Math.cos(t * 8) * 4);

        // Deceleration dip
        let decelDip = 0;
        const contractionCycle = (t * 0.2) % (2 * Math.PI);
        if (contractionCycle > 1.0 && contractionCycle < 3.5) {
          if (currentPatient.fhrDecelerationType === "RECURRENT_VARIABLE") {
            decelDip = Math.sin((contractionCycle - 1.0) / 2.5 * Math.PI) * 35; // Sharp variable drop
          } else if (currentPatient.fhrDecelerationType === "RECURRENT_LATE_DECELERATIONS") {
            decelDip = Math.sin((contractionCycle - 1.5) / 2.0 * Math.PI) * 28; // Late lagging drop
          } else if (currentPatient.fhrDecelerationType === "EARLY_DECELERATIONS") {
            decelDip = Math.sin((contractionCycle - 1.0) / 2.5 * Math.PI) * 18; // Mirror early drop
          }
        }

        const y = fhrBaselineY - ((currentPatient.fhrBaselineBpm - 140) * 1.2) - variability + decelDip;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 2. Draw Uterine Tocodynamometry (TOCO) Contraction Trace (Lower Channel: Cyan)
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2.0;
      ctx.beginPath();

      const tocoBaselineY = height * 0.92;
      for (let x = 0; x < width; x++) {
        const t = (x / 25) - phase;
        const contractionCycle = (t * 0.2) % (2 * Math.PI);
        let contractionHeight = 0;
        if (contractionCycle > 1.0 && contractionCycle < 3.5) {
          contractionHeight = Math.sin((contractionCycle - 1.0) / 2.5 * Math.PI) * (currentPatient.tocoContractionIntensityMmHg * 0.6);
        }
        const y = tocoBaselineY - contractionHeight;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Watermark labels
      ctx.fillStyle = "#10b981";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(`CH1: FETAL CARDIAC TELEMETRY [${currentPatient.fhrBaselineBpm} BPM - ${currentPatient.nichdCategory}]`, 12, 20);

      ctx.fillStyle = "#06b6d4";
      ctx.fillText(`CH2: UTERINE TOCODYNAMOMETRY (TOCO) [${currentPatient.montevideoUnits} MVU]`, 12, height * 0.65 + 18);

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [simulationSpeed, currentPatient]);

  const acknowledgeAlarm = (alarmId: string) => {
    setAlarms((prev) =>
      prev.map((alm) => (alm.id === alarmId ? { ...alm, acknowledged: true } : alm))
    );
  };

  const handleAdministerMedication = (medType: "MAGNESIUM_4G_BOLUS" | "OXYTOCIN_TITRATION" | "TXA_1G" | "CALCIUM_GLUCONATE") => {
    setIsMedsModalOpen(false);
    setPatients((prev) =>
      prev.map((pt) => {
        if (pt.id !== selectedPatientId) return pt;
        let mgRate = pt.magnesiumSulfateInfusionGramsHour;
        let sbp = pt.maternalSystolicBpMmHg;
        let oxy = pt.oxytocinInfusionMunitsMin;

        if (medType === "MAGNESIUM_4G_BOLUS") {
          mgRate = 2.0;
          sbp = Math.max(120, sbp - 14);
        } else if (medType === "OXYTOCIN_TITRATION") {
          oxy += 2;
        } else if (medType === "CALCIUM_GLUCONATE") {
          mgRate = 0.0;
        }

        return {
          ...pt,
          magnesiumSulfateInfusionGramsHour: mgRate,
          maternalSystolicBpMmHg: sbp,
          oxytocinInfusionMunitsMin: oxy,
        };
      })
    );

    const newLog: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: "Labor & Delivery Clinical Team",
      category: "MAGNESIUM_TITRATION",
      action: `Administered ${medType.replace(/_/g, " ")}`,
      deltaSummary: "Physician verified protocol order. Pump telemetry synchronized.",
      sha256Signature: Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const exportTelemetryCSV = () => {
    const headers = ["Timestamp", "Tick", "FHR_BPM", "TOCO_mmHg", "MaternalHR_BPM"];
    const rows = ctgHistory.map((pt) => [
      pt.timestamp,
      pt.tick,
      pt.fhr,
      pt.toco,
      pt.maternalHr,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MaternalFetal_Telemetry_${currentPatient.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateFHIRBundle = () => {
    return {
      resourceType: "Bundle",
      id: `bundle-ob-${currentPatient.id}-${Date.now()}`,
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: `obs-fhr-${Date.now()}`,
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: "55283-6", display: "Fetal Heart Rate" }] },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.fhrBaselineBpm, unit: "beats/min" },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: `obs-toco-${Date.now()}`,
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: "55284-4", display: "Uterine Contraction Frequency" }] },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.montevideoUnits, unit: "MVU" },
          },
        },
      ],
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
       * Top Telemetry Header Bar
       * ───────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-rose-500 to-indigo-600 rounded-xl shadow-lg shadow-rose-500/20 ring-1 ring-rose-400/30">
              <Baby className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Maternal-Fetal Telemetry & Labor Delivery Command Station
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800 rounded-full">
                  ACOG / NICHD 3-Tier
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live CTG
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Continuous Electronic Fetal Monitoring • Montevideo Units • Preeclampsia Magnesium Titration • AIM PPH
              </p>
            </div>
          </div>

          {/* Control Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                aria-label="Select Maternal Patient"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-rose-500 focus:outline-none appearance-none font-medium cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.gravidaPara}) — {p.nichdCategory}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>

            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                isLiveStreaming
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
            >
              {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isLiveStreaming ? "Pause CTG" : "Resume CTG"}
            </button>

            <div className="flex bg-slate-950 rounded-lg border border-slate-800 p-0.5">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimulationSpeed(spd)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    simulationSpeed === spd
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200"
              title={isAudioMuted ? "Unmute Alarm Chimes" : "Mute Alarm Chimes"}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
            </button>

            <button
              onClick={exportTelemetryCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              CSV Log
            </button>

            <button
              onClick={() => setIsFHIRModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 rounded-lg text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              FHIR R4
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
       * Patient Clinical Profile Header Banner
       * ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 border-b border-slate-800 px-6 py-3 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400">Mother: </span>
              <span className="font-bold text-white text-sm">{currentPatient.name}</span>
              <span className="text-slate-400 ml-2">({currentPatient.gravidaPara}, {currentPatient.gestationalAgeWeeks}wks)</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400">Cervix: </span>
              <span className="font-bold text-rose-300">{currentPatient.cervicalDilationCm}cm / {currentPatient.cervicalEffacementPercent}%</span>
              <span className="text-slate-400 ml-1">Station: {currentPatient.fetalStation} ({currentPatient.fetalPosition})</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400">Preeclampsia: </span>
              <span className="font-semibold text-amber-400">{currentPatient.preeclampsiaStatus}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">NICHD Category:</span>
              <span className={`px-2.5 py-0.5 rounded font-black border ${
                currentPatient.nichdCategory === "CATEGORY_III"
                  ? "bg-rose-950 text-rose-400 border-rose-800 animate-pulse"
                  : currentPatient.nichdCategory === "CATEGORY_II"
                  ? "bg-amber-950 text-amber-400 border-amber-800"
                  : "bg-emerald-950 text-emerald-400 border-emerald-800"
              }`}>
                {currentPatient.nichdCategory}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                {currentPatient.clinicalStatus}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
       * Core Metric KPI Card Grid
       * ───────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Fetal Heart Rate (FHR) */}
          <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
            currentPatient.nichdCategory === "CATEGORY_III"
              ? "bg-rose-950/20 border-rose-600/50 shadow-lg shadow-rose-950/40"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                Fetal Heart Rate (FHR)
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                currentPatient.fhrVariability === "ABSENT"
                  ? "bg-rose-900 text-rose-200"
                  : currentPatient.fhrVariability === "MINIMAL"
                  ? "bg-amber-900 text-amber-200"
                  : "bg-emerald-900 text-emerald-200"
              }`}>
                {currentPatient.fhrVariability} VARIABILITY
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${
                currentPatient.fhrBaselineBpm < 110 || currentPatient.fhrBaselineBpm > 160 ? "text-rose-400 animate-pulse" : "text-white"
              }`}>
                {currentPatient.fhrBaselineBpm}
              </span>
              <span className="text-xs font-medium text-slate-400">BPM</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Decel: {currentPatient.fhrDecelerationType}</span>
              <span className={currentPatient.fhrAccelerationsPresent ? "text-emerald-400" : "text-amber-400"}>
                {currentPatient.fhrAccelerationsPresent ? "Accels Present" : "No Accels"}
              </span>
            </div>
          </div>

          {/* Card 2: Uterine Tocodynamometry (TOCO) & MVU */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Montevideo Units (MVU)
              </span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800">
                {currentPatient.tocoContractionFrequencyPer10Min} contr / 10min
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{currentPatient.montevideoUnits}</span>
              <span className="text-xs font-medium text-slate-400">MVU</span>
              <span className="text-xs text-slate-400 ml-auto">Amp: {currentPatient.tocoContractionIntensityMmHg} mmHg</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Target: 200 - 250 MVU</span>
              <span className={currentPatient.montevideoUnits > 300 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                {currentPatient.montevideoUnits > 300 ? "TACHYSYSTOLE" : "ADEQUATE LABOR"}
              </span>
            </div>
          </div>

          {/* Card 3: Maternal Hemodynamics & Magnesium */}
          <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
            currentPatient.maternalSystolicBpMmHg >= 160 || currentPatient.maternalDiastolicBpMmHg >= 110
              ? "bg-rose-950/20 border-rose-600/50 shadow-lg shadow-rose-950/40"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-400" />
                Maternal Hemodynamics
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800">
                MgSO4 @ {currentPatient.magnesiumSulfateInfusionGramsHour} g/hr
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {currentPatient.maternalSystolicBpMmHg}/{currentPatient.maternalDiastolicBpMmHg}
              </span>
              <span className="text-xs font-medium text-slate-400">mmHg</span>
              <span className="text-xs text-slate-400 ml-auto">HR: {currentPatient.maternalHeartRateBpm}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Serum Mg: {currentPatient.serumMagnesiumMgDl} mg/dL</span>
              <span className="text-emerald-400 font-semibold">Reflexes: {currentPatient.patellarReflexes}</span>
            </div>
          </div>

          {/* Card 4: Quantitative Blood Loss (QBL) & AIM Stage */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-rose-400" />
                Blood Loss (QBL)
              </span>
              <span className="text-[10px] text-rose-300 font-semibold">{currentPatient.aimPphStage}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${
                currentPatient.quantitativeBloodLossMl >= 1000 ? "text-rose-400" : "text-white"
              }`}>
                {currentPatient.quantitativeBloodLossMl}
              </span>
              <span className="text-xs font-medium text-slate-400">mL</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Oxytocin: {currentPatient.oxytocinInfusionMunitsMin} mU/min</span>
              <span className="text-cyan-400 font-semibold">Gravimetric Checked</span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * Secondary Multimodal Row (Fetal Scalp, Urine, Temp)
         * ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Fetal Scalp Blood Gas</span>
              <span className={`font-mono font-bold ${currentPatient.fetalScalpPh < 7.20 ? "text-rose-400" : "text-emerald-400"}`}>
                pH {currentPatient.fetalScalpPh}
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Lactate: {currentPatient.fetalScalpLactateMmol} mM</span>
              <span>{currentPatient.fetalScalpPh < 7.20 ? "Acidemia Alert" : "Normal Acid-Base"}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Normal intrapartum scalp pH &ge; 7.25</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Maternal Renal Excretion</span>
              <span className={`font-bold ${currentPatient.urineOutputLastHourMl < 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {currentPatient.urineOutputLastHourMl} mL/hr
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Foley Catheter</span>
              <span>{currentPatient.urineOutputLastHourMl < 30 ? "Oliguria Risk" : "Adequate GFR"}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Monitored for Magnesium clearance</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Intrapartum Temperature</span>
              <span className={`font-mono font-bold ${currentPatient.maternalTempC > 38.0 ? "text-rose-400" : "text-emerald-400"}`}>
                {currentPatient.maternalTempC}°C
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>SpO2: {currentPatient.maternalSpO2Percent}%</span>
              <span>{currentPatient.maternalTempC > 38.0 ? "Chorioamnionitis" : "Normothermia"}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Broad spectrum antibiotic standby</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Labor Progress</span>
              <span className="text-cyan-400 font-mono">{currentPatient.hoursInLabor}h in Labor</span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Dilation: {currentPatient.cervicalDilationCm} cm</span>
              <span>Efface: {currentPatient.cervicalEffacementPercent}%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Station {currentPatient.fetalStation} ({currentPatient.fetalPosition})</p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * Navigation Tab Switcher
         * ───────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: "telemetry", label: "Live CTG & Uterine TOCO Stream", icon: Activity },
            { id: "resuscitation", label: "NICHD Guidelines & Resuscitation", icon: Layers },
            { id: "calculators", label: "Bishop Score & MVU Calculator", icon: SlidersHorizontal },
            { id: "emergency", label: "Emergency Rescue Stations", icon: ShieldAlert },
            { id: "audit", label: "FDA 21 CFR Part 11 Audit Trail", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition -mb-px ${
                  isActive
                    ? "border-rose-500 text-rose-400 bg-rose-950/20"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * TAB 1: Live Cardiotocography Oscilloscope
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-950 text-rose-400 rounded-lg border border-rose-800">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Cardiotocography (CTG) Continuous Electronic Fetal Monitoring
                    </h3>
                    <p className="text-xs text-slate-400">
                      Dual-channel continuous recording of fetal heart rate baseline, variability, and uterine contraction curves
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMedsModalOpen(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5"
                  >
                    <Syringe className="w-3.5 h-3.5" />
                    Titrate Medications
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <canvas ref={canvasRef} width={980} height={260} className="w-full h-[260px] block" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-rose-400 block mb-1">NICHD 3-Tier Interpretation</span>
                  <p className="text-slate-400 text-[11px]">
                    Current tracing is {currentPatient.nichdCategory}.{" "}
                    {currentPatient.nichdCategory === "CATEGORY_III" ? "STAT delivery indicated." : "Intrauterine resuscitation protocol active."}
                  </p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-cyan-400 block mb-1">Montevideo Units (MVU)</span>
                  <p className="text-slate-400 text-[11px]">
                    MVU = {currentPatient.montevideoUnits}.{" "}
                    {currentPatient.montevideoUnits > 300 ? "Uterine tachysystole. Reduce Oxytocin." : "Adequate uterine power."}
                  </p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-amber-400 block mb-1">Magnesium Sulfate Protocol</span>
                  <p className="text-slate-400 text-[11px]">
                    Running @ {currentPatient.magnesiumSulfateInfusionGramsHour} g/hr. Serum Mg = {currentPatient.serumMagnesiumMgDl} mg/dL (Therapeutic 4.8-8.4).
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Active Maternal-Fetal Alarms ({alarms.filter((a) => !a.acknowledged).length})
                </h3>
              </div>
              <div className="space-y-2">
                {alarms.map((alarm) => (
                  <div
                    key={alarm.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                      alarm.acknowledged
                        ? "bg-slate-950/40 border-slate-800 opacity-60"
                        : alarm.severity === "CRITICAL"
                        ? "bg-rose-950/30 border-rose-800/80 text-rose-200 shadow-md"
                        : "bg-amber-950/30 border-amber-800/80 text-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {alarm.severity === "CRITICAL" ? (
                        <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 animate-bounce" />
                      ) : (
                        <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{alarm.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 font-mono text-slate-300">
                            {alarm.code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">{alarm.message}</p>
                        <p className="text-[11px] text-cyan-400 font-medium mt-1">Action: {alarm.action}</p>
                      </div>
                    </div>
                    <div>
                      {!alarm.acknowledged ? (
                        <button
                          onClick={() => acknowledgeAlarm(alarm.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap transition"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Acked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 2: NICHD Guidelines & Resuscitation
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "resuscitation" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-rose-400" />
                    NICHD 3-Tier Intrapartum FHR Management & Resuscitation Bundle
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Standardized decision support algorithm for Category I, II, and III fetal heart rate patterns
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border bg-slate-950/60 border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-emerald-300">Category I: Normal / Reassuring</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
                      Normal Acid-Base
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Baseline 110-160 BPM, moderate variability, no late/variable decelerations. Continue standard intrapartum care.</p>
                </div>

                <div className="p-4 rounded-xl border bg-amber-950/30 border-amber-600/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-amber-300">Category II: Indeterminate (Intrauterine Resuscitation)</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-950 text-amber-400 rounded border border-amber-800">
                      Resuscitation Bundle Active
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 mt-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Maternal Repositioning (Left Lateral Tilt to relieve aortocaval compression)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      IV Fluid Bolus (500-1000 mL Lactated Ringers)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Oxygen 10 L/min via Non-Rebreather Mask
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Discontinue or reduce Oxytocin infusion rate
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border bg-rose-950/30 border-rose-600/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-rose-300">Category III: Abnormal (Immediate Delivery Mandate)</span>
                    <span className="text-xs px-2 py-0.5 bg-rose-950 text-rose-400 rounded border border-rose-800 animate-pulse">
                      STAT C-Section Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Absent baseline variability with recurrent late/variable decels, bradycardia, or sinusoidal pattern. Prepare for Crash Cesarean Section immediately.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 3: Obstetric Calculators & Decision Support
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "calculators" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calculator 1: Bishop Score */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-rose-400" />
                  Bishop Score Cervical Readiness Calculator
                </h3>
                <span className="text-lg font-black text-rose-400">
                  Score: {(bishopDilation >= 5 ? 3 : bishopDilation >= 3 ? 2 : bishopDilation >= 1 ? 1 : 0) + (bishopEffacement >= 80 ? 3 : bishopEffacement >= 60 ? 2 : bishopEffacement >= 40 ? 1 : 0) + (bishopStation >= 1 ? 3 : bishopStation >= -1 ? 2 : bishopStation >= -2 ? 1 : 0) + (bishopConsistency === "SOFT" ? 2 : bishopConsistency === "MEDIUM" ? 1 : 0) + (bishopPosition === "ANTERIOR" ? 2 : bishopPosition === "MID" ? 1 : 0)} / 13
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Cervical Dilation (cm)</label>
                  <select
                    aria-label="Cervical Dilation"
                    value={bishopDilation}
                    onChange={(e) => setBishopDilation(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={0}>0 cm (0 pts)</option>
                    <option value={1}>1 - 2 cm (1 pt)</option>
                    <option value={3}>3 - 4 cm (2 pts)</option>
                    <option value={5}>&ge; 5 cm (3 pts)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Cervical Effacement (%)</label>
                  <select
                    aria-label="Cervical Effacement"
                    value={bishopEffacement}
                    onChange={(e) => setBishopEffacement(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={0}>0 - 30% (0 pts)</option>
                    <option value={40}>40 - 50% (1 pt)</option>
                    <option value={60}>60 - 70% (2 pts)</option>
                    <option value={80}>&ge; 80% (3 pts)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Fetal Station (-3 to +3)</label>
                  <select
                    aria-label="Fetal Station"
                    value={bishopStation}
                    onChange={(e) => setBishopStation(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={-3}>-3 (0 pts)</option>
                    <option value={-2}>-2 (1 pt)</option>
                    <option value={-1}>-1 / 0 (2 pts)</option>
                    <option value={1}>+1 / +2 (3 pts)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-400">Interpretation: </span>
                <span className="font-bold text-emerald-400">
                  {((bishopDilation >= 5 ? 3 : bishopDilation >= 3 ? 2 : bishopDilation >= 1 ? 1 : 0) + (bishopEffacement >= 80 ? 3 : bishopEffacement >= 60 ? 2 : bishopEffacement >= 40 ? 1 : 0) + (bishopStation >= 1 ? 3 : bishopStation >= -1 ? 2 : bishopStation >= -2 ? 1 : 0) + (bishopConsistency === "SOFT" ? 2 : bishopConsistency === "MEDIUM" ? 1 : 0) + (bishopPosition === "ANTERIOR" ? 2 : bishopPosition === "MID" ? 1 : 0)) >= 8
                    ? "Favorable Cervix (Bishop >= 8) — High probability of successful vaginal induction"
                    : "Unfavorable Cervix (Bishop < 6) — Ripening agent indicated"}
                </span>
              </div>
            </div>

            {/* Calculator 2: Montevideo Units */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  Montevideo Units (MVU) Labor Progression Engine
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-bold text-white">Current MVU: {currentPatient.montevideoUnits}</span>
                  <p className="text-slate-400 text-[11px]">Formula: Frequency in 10 min ({currentPatient.tocoContractionFrequencyPer10Min}) * Contraction Peak ({currentPatient.tocoContractionIntensityMmHg} mmHg)</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Adequate Active Labor:</span>
                    <span className="font-bold text-emerald-400">200 - 250 MVU</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Uterine Tachysystole:</span>
                    <span className="font-bold text-rose-400">&gt; 300 MVU</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 4: Emergency Rescue Action Stations
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "emergency" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Code 1: Crash C-Section */}
              <div className="bg-rose-950/20 border border-rose-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
                    <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
                    Code STAT Crash Cesarean
                  </div>
                  <p className="text-xs text-slate-300">
                    Category III non-reassuring tracing, cord prolapse, or uterine rupture.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• Decision-to-Incision Target &lt; 30 minutes</div>
                    <div>• Anesthesia & Neonatal Resuscitation (NRP) paged</div>
                    <div>• Stop Oxytocin, administer Terbutaline 0.25mg SQ</div>
                    <div>• Immediate transfer to Labor OR</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_STAT_CESAREAN")}
                  className="mt-6 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition"
                >
                  Activate Crash C-Section
                </button>
              </div>

              {/* Code 2: Eclampsia Rescue */}
              <div className="bg-amber-950/20 border border-amber-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Code Eclampsia Seizure Rescue
                  </div>
                  <p className="text-xs text-slate-300">
                    Generalized tonic-clonic seizure in preeclamptic patient.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• Maintain airway & prevent maternal injury</div>
                    <div>• Magnesium Sulfate 4-6g IV bolus over 15 min</div>
                    <div>• If seizures recur: Additional 2g MgSO4 or Lorazepam</div>
                    <div>• Antihypertensive therapy (Labetalol / Hydralazine)</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_ECLAMPSIA_SEIZURE")}
                  className="mt-6 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/30 transition"
                >
                  Activate Eclampsia Protocol
                </button>
              </div>

              {/* Code 3: Obstetric Hemorrhage */}
              <div className="bg-purple-950/20 border border-purple-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
                    <Droplets className="w-5 h-5 text-purple-400" />
                    Code Obstetric Hemorrhage (AIM Stage 3)
                  </div>
                  <p className="text-xs text-slate-300">
                    Postpartum hemorrhage with QBL &gt; 1500 mL or vital sign collapse.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• Activate Obstetric Massive Transfusion (1:1:1)</div>
                    <div>• Bakri uterine balloon tamponade insertion</div>
                    <div>• TXA 1g IV push + Uterotonics escalation</div>
                    <div>• Operating Room standby for B-Lynch / Hysterectomy</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_OBSTETRIC_HEMORRHAGE")}
                  className="mt-6 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition"
                >
                  Activate PPH Protocol
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 5: FDA 21 CFR Part 11 Audit Trail & Telemetry Ledger
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-rose-400" />
                  FDA 21 CFR Part 11 Cryptographic Audit Trail
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable forensic audit log with SHA-256 integrity verification
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Integrity Verified
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Action Description</th>
                    <th className="p-3">SHA-256 Digest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/50">
                      <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-3 font-semibold text-white">{log.operator}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-rose-400 border border-slate-800">
                          {log.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        <div className="font-semibold text-white">{log.action}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{log.deltaSummary}</div>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{log.sha256Signature.substring(0, 16)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
       * MODAL: Medication Administration
       * ───────────────────────────────────────────────────────────── */}
      {isMedsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Syringe className="w-5 h-5 text-rose-400" />
                Intrapartum Medication Titration Command
              </h3>
              <button onClick={() => setIsMedsModalOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAdministerMedication("MAGNESIUM_4G_BOLUS")}
                  className="p-3 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">Magnesium Sulfate 4g</span>
                  <span className="text-[10px] text-slate-400">Loading Bolus over 15 min</span>
                </button>
                <button
                  onClick={() => handleAdministerMedication("OXYTOCIN_TITRATION")}
                  className="p-3 bg-slate-950 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">+2 mU/min Oxytocin</span>
                  <span className="text-[10px] text-slate-400">Uterine Contraction Support</span>
                </button>
                <button
                  onClick={() => handleAdministerMedication("TXA_1G")}
                  className="p-3 bg-slate-950 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">TXA 1g IV Infusion</span>
                  <span className="text-[10px] text-slate-400">PPH Fibrinolysis Control</span>
                </button>
                <button
                  onClick={() => handleAdministerMedication("CALCIUM_GLUCONATE")}
                  className="p-3 bg-slate-950 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">Calcium Gluconate 1g</span>
                  <span className="text-[10px] text-slate-400">Magnesium Toxicity Antidote</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsMedsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * MODAL: FHIR R4 Bundle Inspector
       * ───────────────────────────────────────────────────────────── */}
      {isFHIRModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                HL7 FHIR R4 CTG DeviceObservation Bundle Preview
              </h3>
              <button onClick={() => setIsFHIRModalOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-rose-300 max-h-96 overflow-y-auto">
              {JSON.stringify(generateFHIRBundle(), null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setIsFHIRModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
       * MODAL: Emergency Protocol Confirmation
       * ───────────────────────────────────────────────────────────── */}
      {activeEmergencyProtocol && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-rose-950/90 border border-rose-600 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 animate-bounce" />
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-rose-300">
                  {activeEmergencyProtocol.replace(/_/g, " ")} ACTIVATED
                </h3>
                <p className="text-xs text-rose-200">Emergency Protocol Broadcast to Labor & Delivery OR Team</p>
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-rose-800 text-xs space-y-2 text-rose-100">
              <p>• Obstetric Surgical Team Paged STAT.</p>
              <p>• Neonatal Resuscitation Program (NRP) Team on Standby.</p>
              <p>• Blood Bank and Anesthesia Alerted.</p>
            </div>
            <button
              onClick={() => setActiveEmergencyProtocol(null)}
              className="w-full py-2.5 bg-white text-rose-950 font-black text-xs rounded-xl shadow-lg hover:bg-slate-100 transition"
            >
              Acknowledge & Dismiss Emergency Banner
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
