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
  Package,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * TypeScript Interfaces & Constants
 * ───────────────────────────────────────────────────────────── */

export interface TraumaPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  injuryMechanism: string;
  injurySeverityScore: number;
  admissionDate: string;
  minutesFromInjury: number;
  heartRateBpm: number;
  systolicBpMmHg: number;
  diastolicBpMmHg: number;
  meanArterialPressureMmHg: number;
  shockIndex: number;
  respiratoryRateBpm: number;
  spO2Percent: number;
  coreTemperatureC: number;
  abcScore: number;
  fastUltrasoundMorisonPouch: string;
  fastUltrasoundSplenorenal: string;
  fastUltrasoundPelvis: string;
  fastUltrasoundPericardial: string;
  tegRTimeMin: number;
  tegKTimeMin: number;
  tegAlphaAngleDeg: number;
  tegMaximumAmplitudeMm: number;
  tegLy30Percent: number;
  prbcUnitsTransfused: number;
  ffpUnitsTransfused: number;
  plateletUnitsTransfused: number;
  cryoUnitsTransfused: number;
  txaAdministeredGrams: number;
  rapidInfuserRateMlMin: number;
  rapidInfuserTotalVolumeMl: number;
  rapidInfuserLinePressureMmHg: number;
  rapidInfuserWarmerTempC: number;
  arterialPh: number;
  arterialLactateMmol: number;
  baseDeficitMeqL: number;
  hemoglobinGdl: number;
  plateletsPerUl: number;
  ionizedCalciumMmolL: number;
  fibrinogenMgDl: number;
  reboaStatus: "NOT_DEPLOYED" | "ZONE_I_INFLATED" | "ZONE_III_INFLATED" | "ZONE_III_DEFLATED";
  reboaOcclusionMinutes: number;
  surgicalStatus: string;
  clinicalStatus: string;
}

export interface TelemetryDataPoint {
  timestamp: string;
  tick: number;
  hr: number;
  sbp: number;
  dbp: number;
  map: number;
  shockIndex: number;
  infusionRate: number;
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
  category: "MTP_TRANSFUSION" | "TEG_GUIDANCE" | "REBOA_OCCLUSION" | "CALCIUM_REPLETION" | "EMERGENCY_PROTOCOL" | "SYSTEM";
  action: string;
  deltaSummary: string;
  sha256Signature: string;
}

const INITIAL_PATIENTS: TraumaPatient[] = [
  {
    id: "PT-TRAUMA-7701",
    name: "Captain Zachary Vance",
    mrn: "MRN-5519401",
    age: 29,
    gender: "Male",
    weightKg: 78,
    heightCm: 180,
    injuryMechanism: "High-Velocity Motor Vehicle Collision with Steering Wheel Crush Injury",
    injurySeverityScore: 34,
    admissionDate: "2026-08-22T19:30:00Z",
    minutesFromInjury: 42,
    heartRateBpm: 138,
    systolicBpMmHg: 76,
    diastolicBpMmHg: 44,
    meanArterialPressureMmHg: 54.7,
    shockIndex: 1.82,
    respiratoryRateBpm: 28,
    spO2Percent: 92.0,
    coreTemperatureC: 35.4,
    abcScore: 3,
    fastUltrasoundMorisonPouch: "POSITIVE_FREE_FLUID",
    fastUltrasoundSplenorenal: "POSITIVE_FREE_FLUID",
    fastUltrasoundPelvis: "POSITIVE_FREE_FLUID",
    fastUltrasoundPericardial: "NEGATIVE",
    tegRTimeMin: 10.4,
    tegKTimeMin: 4.2,
    tegAlphaAngleDeg: 52.0,
    tegMaximumAmplitudeMm: 44.0,
    tegLy30Percent: 6.8,
    prbcUnitsTransfused: 6,
    ffpUnitsTransfused: 4,
    plateletUnitsTransfused: 1,
    cryoUnitsTransfused: 0,
    txaAdministeredGrams: 1.0,
    rapidInfuserRateMlMin: 450,
    rapidInfuserTotalVolumeMl: 2850,
    rapidInfuserLinePressureMmHg: 180,
    rapidInfuserWarmerTempC: 40.5,
    arterialPh: 7.18,
    arterialLactateMmol: 6.4,
    baseDeficitMeqL: -9.2,
    hemoglobinGdl: 7.2,
    plateletsPerUl: 68000,
    ionizedCalciumMmolL: 0.94,
    fibrinogenMgDl: 110,
    reboaStatus: "ZONE_I_INFLATED",
    reboaOcclusionMinutes: 14.5,
    surgicalStatus: "OR_DAMAGE_CONTROL_STANDBY",
    clinicalStatus: "CRITICAL_EXSANGUINATING_SHOCK_MTP_ACTIVE",
  },
  {
    id: "PT-TRAUMA-7702",
    name: "Sergeant Maya Lin",
    mrn: "MRN-6628104",
    age: 34,
    gender: "Female",
    weightKg: 62,
    heightCm: 168,
    injuryMechanism: "Multiple Gunshot Wounds to Right Thoraco-Abdominal Cavity",
    injurySeverityScore: 29,
    admissionDate: "2026-08-22T20:10:00Z",
    minutesFromInjury: 28,
    heartRateBpm: 122,
    systolicBpMmHg: 88,
    diastolicBpMmHg: 52,
    meanArterialPressureMmHg: 64.0,
    shockIndex: 1.39,
    respiratoryRateBpm: 24,
    spO2Percent: 96.0,
    coreTemperatureC: 36.2,
    abcScore: 3,
    fastUltrasoundMorisonPouch: "NEGATIVE",
    fastUltrasoundSplenorenal: "NEGATIVE",
    fastUltrasoundPelvis: "NEGATIVE",
    fastUltrasoundPericardial: "NEGATIVE",
    tegRTimeMin: 6.2,
    tegKTimeMin: 2.1,
    tegAlphaAngleDeg: 66.0,
    tegMaximumAmplitudeMm: 58.0,
    tegLy30Percent: 1.8,
    prbcUnitsTransfused: 2,
    ffpUnitsTransfused: 2,
    plateletUnitsTransfused: 0,
    cryoUnitsTransfused: 0,
    txaAdministeredGrams: 1.0,
    rapidInfuserRateMlMin: 200,
    rapidInfuserTotalVolumeMl: 1100,
    rapidInfuserLinePressureMmHg: 120,
    rapidInfuserWarmerTempC: 40.0,
    arterialPh: 7.31,
    arterialLactateMmol: 3.8,
    baseDeficitMeqL: -4.5,
    hemoglobinGdl: 9.6,
    plateletsPerUl: 142000,
    ionizedCalciumMmolL: 1.12,
    fibrinogenMgDl: 185,
    reboaStatus: "NOT_DEPLOYED",
    reboaOcclusionMinutes: 0,
    surgicalStatus: "EXPLORATORY_LAPAROTOMY_ACTIVE",
    clinicalStatus: "MODERATE_HEMORRHAGIC_SHOCK_CONTROLLED",
  },
  {
    id: "PT-TRAUMA-7703",
    name: "Arthur Pendelton, EMT-P",
    mrn: "MRN-4491028",
    age: 48,
    gender: "Male",
    weightKg: 86,
    heightCm: 175,
    injuryMechanism: "Pedestrian vs Industrial Heavy Forklift - Open Pelvic Fracture",
    injurySeverityScore: 41,
    admissionDate: "2026-08-22T18:45:00Z",
    minutesFromInjury: 85,
    heartRateBpm: 110,
    systolicBpMmHg: 96,
    diastolicBpMmHg: 60,
    meanArterialPressureMmHg: 72.0,
    shockIndex: 1.15,
    respiratoryRateBpm: 18,
    spO2Percent: 98.0,
    coreTemperatureC: 36.8,
    abcScore: 2,
    fastUltrasoundMorisonPouch: "NEGATIVE",
    fastUltrasoundSplenorenal: "NEGATIVE",
    fastUltrasoundPelvis: "POSITIVE_RETROPERITONEAL_HEMATOMA",
    fastUltrasoundPericardial: "NEGATIVE",
    tegRTimeMin: 7.0,
    tegKTimeMin: 1.8,
    tegAlphaAngleDeg: 71.0,
    tegMaximumAmplitudeMm: 62.0,
    tegLy30Percent: 0.9,
    prbcUnitsTransfused: 8,
    ffpUnitsTransfused: 8,
    plateletUnitsTransfused: 2,
    cryoUnitsTransfused: 2,
    txaAdministeredGrams: 2.0,
    rapidInfuserRateMlMin: 50,
    rapidInfuserTotalVolumeMl: 4600,
    rapidInfuserLinePressureMmHg: 90,
    rapidInfuserWarmerTempC: 39.5,
    arterialPh: 7.36,
    arterialLactateMmol: 2.1,
    baseDeficitMeqL: -2.0,
    hemoglobinGdl: 10.4,
    plateletsPerUl: 165000,
    ionizedCalciumMmolL: 1.21,
    fibrinogenMgDl: 220,
    reboaStatus: "ZONE_III_DEFLATED",
    reboaOcclusionMinutes: 22.0,
    surgicalStatus: "PELVIC_ANGIOEMBOLIZATION_COMPLETE",
    clinicalStatus: "RESUSCITATED_POST_PACKING_STABILIZED",
  },
];

/* ─────────────────────────────────────────────────────────────
 * Main Component Definition
 * ───────────────────────────────────────────────────────────── */

export default function TraumaResuscitationMTPPage(): JSX.Element {
  const [patients, setPatients] = useState<TraumaPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("PT-TRAUMA-7701");
  const [activeTab, setActiveTab] = useState<"telemetry" | "mtp" | "calculators" | "emergency" | "audit">("telemetry");
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryDataPoint[]>([]);
  const [, setTickCounter] = useState<number>(0);
  const [alarms, setAlarms] = useState<ClinicalAlarm[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeEmergencyProtocol, setActiveEmergencyProtocol] = useState<string | null>(null);
  const [isFHIRModalOpen, setIsFHIRModalOpen] = useState<boolean>(false);
  const [isProductReleaseModalOpen, setIsProductReleaseModalOpen] = useState<boolean>(false);

  // ABC Score Calculator inputs
  const [calcIsPenetrating, setCalcIsPenetrating] = useState<boolean>(false);
  const [calcSbp, setCalcSbp] = useState<number>(80);
  const [calcHr, setCalcHr] = useState<number>(130);
  const [calcIsFastPos, setCalcIsFastPos] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  // Initialize Audit Log and Alarms on mount
  useEffect(() => {
    const initialLogs: AuditLogEntry[] = [
      {
        id: "AUD-TRAUMA-001",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        operator: "Dr. Rachel Thorne, MD (Trauma Surgeon)",
        category: "MTP_TRANSFUSION",
        action: "Activated Massive Transfusion Protocol (Cooler 1 Received)",
        deltaSummary: "ABC Score 3. Administered 4 PRBC, 4 FFP, 1 Platelet Apheresis via Belmont FMS.",
        sha256Signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
      {
        id: "AUD-TRAUMA-002",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        operator: "Marcus Brody, RN (Trauma Bay Lead)",
        category: "CALCIUM_REPLETION",
        action: "Administered 1g IV Calcium Chloride",
        deltaSummary: "Ionized Ca 0.94 mmol/L after 4 units PRBC. Corrected citrate binding hypocalcemia.",
        sha256Signature: "9f83c6051a8c055e11b8424b536f59fdb5f4315ce924a6164f7e1e149afbf4c8",
      },
    ];
    setAuditLogs(initialLogs);

    const initialAlarms: ClinicalAlarm[] = [
      {
        id: "ALM-TR-001",
        timestamp: new Date().toISOString(),
        code: "SHOCK_INDEX_CRITICAL",
        severity: "CRITICAL",
        title: "Severe Hemorrhagic Shock (SI = 1.82)",
        message: "Heart rate (138) exceeds SBP (76). High mortality exsanguinating hemorrhage.",
        action: "Maximize rapid infuser flow, deploy Cooler 2, expedite surgical hemostasis.",
        acknowledged: false,
      },
      {
        id: "ALM-TR-002",
        timestamp: new Date().toISOString(),
        code: "HYPERFIBRINOLYSIS_TEG",
        severity: "HIGH_RISK",
        title: "TEG Hyperfibrinolysis (LY30 = 6.8%)",
        message: "Clot lysis > 3.0% indicates systemic hyperfibrinolytic state.",
        action: "Administer TXA 1g IV loading dose immediately.",
        acknowledged: false,
      },
    ];
    setAlarms(initialAlarms);

    const initialHist: TelemetryDataPoint[] = [];
    for (let i = 20; i >= 0; i--) {
      initialHist.push({
        timestamp: new Date(Date.now() - i * 3000).toISOString(),
        tick: -i,
        hr: currentPatient.heartRateBpm + (Math.sin(i) * 3),
        sbp: currentPatient.systolicBpMmHg + (Math.cos(i) * 2),
        dbp: currentPatient.diastolicBpMmHg + (Math.sin(i * 0.5) * 2),
        map: currentPatient.meanArterialPressureMmHg + (Math.cos(i * 0.5) * 2),
        shockIndex: currentPatient.shockIndex,
        infusionRate: currentPatient.rapidInfuserRateMlMin,
      });
    }
    setTelemetryHistory(initialHist);
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

          const noiseHr = (Math.random() - 0.5) * 1.5;
          const noiseSbp = (Math.random() - 0.48) * 1.2;
          const newHr = Math.max(40, Math.min(190, Number((pt.heartRateBpm + noiseHr).toFixed(0))));
          const newSbp = Math.max(40, Math.min(220, Number((pt.systolicBpMmHg + noiseSbp).toFixed(0))));
          const newDbp = Math.max(20, Math.min(120, Number((pt.diastolicBpMmHg + (Math.random() - 0.5) * 0.8).toFixed(0))));
          const newMap = Number(((newSbp + (2 * newDbp)) / 3).toFixed(1));
          const newSi = Number((newHr / newSbp).toFixed(2));

          return {
            ...pt,
            heartRateBpm: newHr,
            systolicBpMmHg: newSbp,
            diastolicBpMmHg: newDbp,
            meanArterialPressureMmHg: newMap,
            shockIndex: newSi,
          };
        })
      );

      setTelemetryHistory((prev) => {
        const last = prev[prev.length - 1] || {
          hr: currentPatient.heartRateBpm,
          sbp: currentPatient.systolicBpMmHg,
          dbp: currentPatient.diastolicBpMmHg,
          map: currentPatient.meanArterialPressureMmHg,
          shockIndex: currentPatient.shockIndex,
          infusionRate: currentPatient.rapidInfuserRateMlMin,
        };

        const newPoint: TelemetryDataPoint = {
          timestamp: new Date().toISOString(),
          tick: (last.tick || 0) + 1,
          hr: currentPatient.heartRateBpm,
          sbp: currentPatient.systolicBpMmHg,
          dbp: currentPatient.diastolicBpMmHg,
          map: currentPatient.meanArterialPressureMmHg,
          shockIndex: currentPatient.shockIndex,
          infusionRate: currentPatient.rapidInfuserRateMlMin,
        };

        const updated = [...prev, newPoint];
        return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isLiveStreaming, simulationSpeed, selectedPatientId, currentPatient]);

  // High-Resolution Oscilloscope Canvas (Arterial Pulse + TEG Profile)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      phase += 0.12 * simulationSpeed;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      // Grid Lines
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 1. Draw Arterial Line Pulsatile Pressure Trace (Rose / Red)
      ctx.strokeStyle = currentPatient.shockIndex >= 1.3 ? "#f43f5e" : "#fb7185";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const baseArtY = height * 0.4;
      for (let x = 0; x < width * 0.6; x++) {
        const t = (x / 20) - phase;
        const cardiacCycle = t % (2 * Math.PI);
        let pulseHeight = 0;
        if (cardiacCycle > 0 && cardiacCycle < 1.6) {
          const systolicPeak = Math.sin(cardiacCycle * 3.8) * (currentPatient.systolicBpMmHg * 0.4);
          const dicroticNotch = Math.sin((cardiacCycle - 0.5) * 3.0) * (currentPatient.diastolicBpMmHg * 0.2);
          pulseHeight = Math.max(0, systolicPeak + dicroticNotch);
        }
        const y = baseArtY - pulseHeight;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 2. Draw TEG (Thromboelastography) Clot Signature (Cyan / Amber)
      const tegStartX = width * 0.65;
      const tegCenterY = height * 0.5;
      const tegWidth = width * 0.32;

      ctx.strokeStyle = currentPatient.tegLy30Percent > 3.0 ? "#f59e0b" : "#06b6d4";
      ctx.lineWidth = 2.0;

      // Upper Envelope of TEG
      ctx.beginPath();
      for (let x = 0; x < tegWidth; x++) {
        const t = x / tegWidth;
        let amplitude = 0;
        if (t > 0.15) {
          // Beyond R-time
          const growth = (t - 0.15) / 0.3;
          amplitude = Math.min(currentPatient.tegMaximumAmplitudeMm * 0.7, growth * currentPatient.tegMaximumAmplitudeMm * 0.7);
          if (t > 0.6 && currentPatient.tegLy30Percent > 3.0) {
            // Lysis drop
            amplitude *= Math.max(0.4, 1.0 - ((t - 0.6) * 1.5));
          }
        }
        const canvasX = tegStartX + x;
        const canvasY = tegCenterY - amplitude;
        if (x === 0) ctx.moveTo(canvasX, canvasY);
        else ctx.lineTo(canvasX, canvasY);
      }
      ctx.stroke();

      // Lower Envelope of TEG (Mirror)
      ctx.beginPath();
      for (let x = 0; x < tegWidth; x++) {
        const t = x / tegWidth;
        let amplitude = 0;
        if (t > 0.15) {
          const growth = (t - 0.15) / 0.3;
          amplitude = Math.min(currentPatient.tegMaximumAmplitudeMm * 0.7, growth * currentPatient.tegMaximumAmplitudeMm * 0.7);
          if (t > 0.6 && currentPatient.tegLy30Percent > 3.0) {
            amplitude *= Math.max(0.4, 1.0 - ((t - 0.6) * 1.5));
          }
        }
        const canvasX = tegStartX + x;
        const canvasY = tegCenterY + amplitude;
        if (x === 0) ctx.moveTo(canvasX, canvasY);
        else ctx.lineTo(canvasX, canvasY);
      }
      ctx.stroke();

      // Watermark labels
      ctx.fillStyle = "#f43f5e";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText("CH1: INVASIVE RADIAL ARTERIAL LINE [mmHg]", 12, 22);

      ctx.fillStyle = "#06b6d4";
      ctx.fillText("CH2: TEG 6s REAL-TIME CLOT ELASTIC PROFILE", tegStartX, 22);

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

  const handleAdministerBloodProduct = (productType: "PRBC" | "FFP" | "PLATELETS" | "CRYO" | "TXA" | "CALCIUM") => {
    setIsProductReleaseModalOpen(false);
    setPatients((prev) =>
      prev.map((pt) => {
        if (pt.id !== selectedPatientId) return pt;
        let prbc = pt.prbcUnitsTransfused;
        let ffp = pt.ffpUnitsTransfused;
        let plt = pt.plateletUnitsTransfused;
        let cryo = pt.cryoUnitsTransfused;
        let txa = pt.txaAdministeredGrams;
        let ca = pt.ionizedCalciumMmolL;
        let sbp = pt.systolicBpMmHg;

        if (productType === "PRBC") {
          prbc += 2;
          sbp += 6;
          ca = Math.max(0.7, Number((ca - 0.04).toFixed(2)));
        } else if (productType === "FFP") {
          ffp += 2;
          sbp += 4;
        } else if (productType === "PLATELETS") {
          plt += 1;
        } else if (productType === "CRYO") {
          cryo += 1;
        } else if (productType === "TXA") {
          txa += 1.0;
        } else if (productType === "CALCIUM") {
          ca = Math.min(1.3, Number((ca + 0.18).toFixed(2)));
        }

        return {
          ...pt,
          prbcUnitsTransfused: prbc,
          ffpUnitsTransfused: ffp,
          plateletUnitsTransfused: plt,
          cryoUnitsTransfused: cryo,
          txaAdministeredGrams: txa,
          ionizedCalciumMmolL: ca,
          systolicBpMmHg: sbp,
        };
      })
    );

    const newLog: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: "Trauma Resuscitation Team",
      category: "MTP_TRANSFUSION",
      action: `Administered ${productType}`,
      deltaSummary: `Blood bank verified release of ${productType}. Infused via rapid warmer.`,
      sha256Signature: Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const exportTelemetryCSV = () => {
    const headers = ["Timestamp", "Tick", "HeartRate_BPM", "SystolicBP_mmHg", "DiastolicBP_mmHg", "MAP_mmHg", "ShockIndex", "InfusionRate_mLmin"];
    const rows = telemetryHistory.map((pt) => [
      pt.timestamp,
      pt.tick,
      pt.hr,
      pt.sbp,
      pt.dbp,
      pt.map,
      pt.shockIndex,
      pt.infusionRate,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trauma_Resuscitation_${currentPatient.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateFHIRBundle = () => {
    return {
      resourceType: "Bundle",
      id: `bundle-trauma-${currentPatient.id}-${Date.now()}`,
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: `obs-hr-${Date.now()}`,
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.heartRateBpm, unit: "beats/min" },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: `obs-sbp-${Date.now()}`,
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.systolicBpMmHg, unit: "mmHg" },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: `obs-si-${Date.now()}`,
            status: "final",
            code: { coding: [{ system: "http://loinc.org", code: "89276-0", display: "Shock index" }] },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.shockIndex, unit: "ratio" },
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
            <div className="p-2.5 bg-gradient-to-tr from-rose-600 to-amber-600 rounded-xl shadow-lg shadow-rose-500/20 ring-1 ring-rose-400/30">
              <Flame className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Trauma Resuscitation & Massive Transfusion Command Station
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800 rounded-full">
                  ACS-TQIP / Damage Control
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Resuscitation
                </span>
              </div>
              <p className="text-xs text-slate-400">
                1:1:1 Balanced MTP • Goal-Directed TEG 6s • Rapid Infuser Telemetry • Permissive Hypotension • REBOA
              </p>
            </div>
          </div>

          {/* Control Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                aria-label="Select Trauma Patient"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-rose-500 focus:outline-none appearance-none font-medium cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn}) — ISS {p.injurySeverityScore}
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
              {isLiveStreaming ? "Pause Stream" : "Resume Stream"}
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
              <span className="text-slate-400">Patient: </span>
              <span className="font-bold text-white text-sm">{currentPatient.name}</span>
              <span className="text-slate-400 ml-2">({currentPatient.gender}, {currentPatient.age}y, {currentPatient.weightKg}kg)</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400">Mechanism: </span>
              <span className="font-semibold text-rose-300">{currentPatient.injuryMechanism}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400">ISS: </span>
              <span className="font-bold text-amber-400">{currentPatient.injurySeverityScore} (Severe)</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">ABC Score:</span>
              <span className="px-2 py-0.5 rounded font-bold bg-rose-950 text-rose-400 border border-rose-800">
                {currentPatient.abcScore} / 4 ({currentPatient.abcScore >= 2 ? "MTP Active" : "Non-MTP"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">REBOA:</span>
              <span className="px-2.5 py-0.5 rounded font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                {currentPatient.reboaStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-rose-950 text-rose-400 border border-rose-700">
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
          {/* Card 1: Shock Index (SI) */}
          <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
            currentPatient.shockIndex >= 1.3
              ? "bg-rose-950/20 border-rose-600/50 shadow-lg shadow-rose-950/40"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                Shock Index (HR / SBP)
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                currentPatient.shockIndex >= 1.3
                  ? "bg-rose-900 text-rose-200 animate-pulse"
                  : currentPatient.shockIndex >= 0.9
                  ? "bg-amber-900 text-amber-200"
                  : "bg-emerald-900 text-emerald-200"
              }`}>
                {currentPatient.shockIndex >= 1.3 ? "CRITICAL SHOCK" : currentPatient.shockIndex >= 0.9 ? "ELEVATED" : "NORMAL"}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${
                currentPatient.shockIndex >= 1.3 ? "text-rose-400 animate-pulse" : "text-white"
              }`}>
                {currentPatient.shockIndex.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400">ratio</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>HR: {currentPatient.heartRateBpm} | SBP: {currentPatient.systolicBpMmHg}</span>
              <span className="text-rose-300 font-medium">Target SI &lt; 0.7</span>
            </div>
          </div>

          {/* Card 2: 1:1:1 Balanced MTP Transfusion Tracker */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-rose-400" />
                1:1:1 MTP Balanced Units
              </span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800">
                PRBC:FFP {currentPatient.prbcUnitsTransfused}:{currentPatient.ffpUnitsTransfused}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1 text-center">
              <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">PRBC</div>
                <div className="text-lg font-bold text-rose-400">{currentPatient.prbcUnitsTransfused}u</div>
              </div>
              <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">FFP</div>
                <div className="text-lg font-bold text-amber-400">{currentPatient.ffpUnitsTransfused}u</div>
              </div>
              <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Platelets</div>
                <div className="text-lg font-bold text-cyan-400">{currentPatient.plateletUnitsTransfused}u</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-800/80 pt-1.5">
              <span>TXA: {currentPatient.txaAdministeredGrams}g</span>
              <span>Cryo: {currentPatient.cryoUnitsTransfused} pools</span>
            </div>
          </div>

          {/* Card 3: Goal-Directed TEG 6s Coagulopathy */}
          <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
            currentPatient.tegLy30Percent > 3.0 || currentPatient.tegRTimeMin > 8.0
              ? "bg-amber-950/20 border-amber-600/50 shadow-lg shadow-amber-950/40"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                TEG 6s Coagulation
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                currentPatient.tegLy30Percent > 3.0
                  ? "bg-rose-950 text-rose-400 border border-rose-800 animate-pulse"
                  : "bg-emerald-950 text-emerald-400 border border-emerald-800"
              }`}>
                LY30: {currentPatient.tegLy30Percent}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
              <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px]">R-Time:</span>
                <span className={`font-bold ml-1 ${currentPatient.tegRTimeMin > 8 ? "text-amber-400" : "text-white"}`}>
                  {currentPatient.tegRTimeMin} min
                </span>
              </div>
              <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px]">MA (Clot):</span>
                <span className={`font-bold ml-1 ${currentPatient.tegMaximumAmplitudeMm < 52 ? "text-amber-400" : "text-white"}`}>
                  {currentPatient.tegMaximumAmplitudeMm} mm
                </span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-800/80 pt-1.5">
              <span>Angle: {currentPatient.tegAlphaAngleDeg}°</span>
              <span className={currentPatient.tegLy30Percent > 3 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                {currentPatient.tegLy30Percent > 3 ? "HYPERFIBRINOLYSIS" : "STABLE CLOT"}
              </span>
            </div>
          </div>

          {/* Card 4: Rapid Infuser Telemetry (Belmont FMS) */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-indigo-400" />
                Rapid Infuser (Belmont)
              </span>
              <span className="text-[10px] text-indigo-300 font-semibold">{currentPatient.rapidInfuserWarmerTempC}°C Warmer</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{currentPatient.rapidInfuserRateMlMin}</span>
              <span className="text-xs font-medium text-slate-400">mL/min</span>
              <span className="text-xs text-slate-400 ml-auto">Tot: {currentPatient.rapidInfuserTotalVolumeMl} mL</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Line Press: {currentPatient.rapidInfuserLinePressureMmHg} mmHg</span>
              <span className="text-emerald-400 font-semibold">WARMER ACTIVE</span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * Secondary Multimodal Row (Lethal Triad, FAST, Labs)
         * ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                Core Temp & Acidosis
              </span>
              <span className={`font-mono font-bold ${currentPatient.coreTemperatureC < 35.5 ? "text-rose-400" : "text-emerald-400"}`}>
                {currentPatient.coreTemperatureC}°C
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>pH: {currentPatient.arterialPh}</span>
              <span>Lact: {currentPatient.arterialLactateMmol} mM</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Base Deficit: {currentPatient.baseDeficitMeqL} mEq/L</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">FAST Ultrasound</span>
              <span className={`font-bold ${currentPatient.fastUltrasoundMorisonPouch.includes("POSITIVE") ? "text-rose-400" : "text-emerald-400"}`}>
                {currentPatient.fastUltrasoundMorisonPouch.includes("POSITIVE") ? "POSITIVE 3-QUAD" : "NEGATIVE"}
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Morison: POS</span>
              <span>Pelvis: POS</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Free fluid detected in peritoneum</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Ionized Calcium ($iCa^{2+}$)</span>
              <span className={`font-mono font-bold ${currentPatient.ionizedCalciumMmolL < 1.0 ? "text-rose-400 animate-pulse" : "text-emerald-400"}`}>
                {currentPatient.ionizedCalciumMmolL} mM
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Target: &ge; 1.15</span>
              <span>Citrate Bind: {currentPatient.ionizedCalciumMmolL < 1.0 ? "HIGH" : "NORMAL"}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {currentPatient.ionizedCalciumMmolL < 1.0 ? "Administer 1g IV CaCl2" : "Calcium Replete"}
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Hematology & Fibrinogen</span>
              <span className="text-cyan-400 font-mono">Hb {currentPatient.hemoglobinGdl} g/dL</span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Plt: {currentPatient.plateletsPerUl / 1000}k</span>
              <span>Fib: {currentPatient.fibrinogenMgDl} mg/dL</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {currentPatient.fibrinogenMgDl < 150 ? "Cryoprecipitate Indicated" : "Adequate Substrate"}
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * Navigation Tab Switcher
         * ───────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: "telemetry", label: "Live Hemodynamics & TEG Stream", icon: Activity },
            { id: "mtp", label: "MTP Blood Product Dispatcher", icon: Package },
            { id: "calculators", label: "ABC Score & Coagulopathy Engine", icon: SlidersHorizontal },
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
         * TAB 1: Live Resuscitation & TEG Waveform Stream
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
                      Invasive Arterial Pressure Waveform & Goal-Directed TEG 6s Analyzer
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time arterial line pulsatile waveform and viscoelastic clot kinetics profile
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsProductReleaseModalOpen(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Dispense Blood Units
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <canvas ref={canvasRef} width={980} height={260} className="w-full h-[260px] block" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-rose-400 block mb-1">Permissive Hypotension Status</span>
                  <p className="text-slate-400 text-[11px]">
                    SBP = {currentPatient.systolicBpMmHg} mmHg. Target 80-90 mmHg until surgical hemostasis to prevent clot disruption.
                  </p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-cyan-400 block mb-1">TEG Clot Strength Index (MA)</span>
                  <p className="text-slate-400 text-[11px]">
                    MA = {currentPatient.tegMaximumAmplitudeMm} mm.{" "}
                    {currentPatient.tegMaximumAmplitudeMm < 52 ? "Platelet dysfunction. Apheresis platelet unit indicated." : "Adequate clot elasticity."}
                  </p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-amber-400 block mb-1">Fibrinolysis Index (LY30)</span>
                  <p className="text-slate-400 text-[11px]">
                    LY30 = {currentPatient.tegLy30Percent}%.{" "}
                    {currentPatient.tegLy30Percent > 3.0 ? "Critical hyperfibrinolysis. TXA infusion mandatory." : "Normal clot stability."}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Active Trauma Resuscitation Alarms ({alarms.filter((a) => !a.acknowledged).length})
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
         * TAB 2: MTP Blood Product Dispatcher
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "mtp" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-rose-400" />
                    Massive Transfusion Protocol (MTP) Cooler Dispatcher
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Balanced 1:1:1 whole blood equivalence dispensing system with citrate toxicity surveillance
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">MTP Status:</span>
                  <span className="px-3 py-1 bg-rose-950 text-rose-400 font-bold text-xs rounded-lg border border-rose-700">
                    ACTIVE (Cooler 2 In Transit)
                  </span>
                </div>
              </div>

              {/* Cooler Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-rose-300">Cooler 1 (Emergency Initial Pack)</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
                      Delivered & Transfused
                    </span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li>• 4 Units Packed Red Blood Cells (PRBC Type O-)</li>
                    <li>• 4 Units Fresh Frozen Plasma (FFP Type AB)</li>
                    <li>• 1 Unit Platelet Apheresis (6-unit equivalent)</li>
                    <li>• 1g IV Tranexamic Acid (TXA)</li>
                  </ul>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-300">Cooler 2 (Sustained Resuscitation)</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-950 text-amber-400 rounded border border-amber-800">
                      Dispensing in Bay
                    </span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1">
                    <li>• 4 Units Packed Red Blood Cells (PRBC)</li>
                    <li>• 4 Units Fresh Frozen Plasma (FFP)</li>
                    <li>• 1 Unit Platelet Apheresis</li>
                    <li>• 2 Pools Cryoprecipitate (10 units) + 1g Calcium Chloride</li>
                  </ul>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-rose-400" />
                  Quick Resuscitation Bolus Commands
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <button
                    onClick={() => handleAdministerBloodProduct("PRBC")}
                    className="px-3 py-2 bg-rose-950 text-rose-300 border border-rose-800 rounded-lg hover:bg-rose-900 font-semibold"
                  >
                    +2 Units PRBC
                  </button>
                  <button
                    onClick={() => handleAdministerBloodProduct("FFP")}
                    className="px-3 py-2 bg-amber-950 text-amber-300 border border-amber-800 rounded-lg hover:bg-amber-900 font-semibold"
                  >
                    +2 Units FFP
                  </button>
                  <button
                    onClick={() => handleAdministerBloodProduct("PLATELETS")}
                    className="px-3 py-2 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-lg hover:bg-cyan-900 font-semibold"
                  >
                    +1 Unit Platelets
                  </button>
                  <button
                    onClick={() => handleAdministerBloodProduct("CRYO")}
                    className="px-3 py-2 bg-purple-950 text-purple-300 border border-purple-800 rounded-lg hover:bg-purple-900 font-semibold"
                  >
                    +1 Pool Cryoprecipitate
                  </button>
                  <button
                    onClick={() => handleAdministerBloodProduct("CALCIUM")}
                    className="px-3 py-2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg hover:bg-emerald-900 font-semibold"
                  >
                    +1g IV Calcium Chloride
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 3: Trauma Calculators & Decision Support
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "calculators" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calculator 1: ABC Score */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  Assessment of Blood Consumption (ABC) Score
                </h3>
                <span className="text-lg font-black text-rose-400">
                  Score: {(calcIsPenetrating ? 1 : 0) + (calcSbp <= 90 ? 1 : 0) + (calcHr >= 120 ? 1 : 0) + (calcIsFastPos ? 1 : 0)} / 4
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calcIsPenetrating}
                    onChange={(e) => setCalcIsPenetrating(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
                  />
                  <span>Penetrating Injury Mechanism (+1)</span>
                </label>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Systolic Blood Pressure (SBP &le; 90 mmHg: +1)</span>
                    <span className="font-bold text-white">{calcSbp} mmHg</span>
                  </div>
                  <input
                    aria-label="Systolic Blood Pressure"
                    type="range"
                    min={50}
                    max={160}
                    value={calcSbp}
                    onChange={(e) => setCalcSbp(Number(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Heart Rate (HR &ge; 120 BPM: +1)</span>
                    <span className="font-bold text-white">{calcHr} BPM</span>
                  </div>
                  <input
                    aria-label="Heart Rate"
                    type="range"
                    min={60}
                    max={180}
                    value={calcHr}
                    onChange={(e) => setCalcHr(Number(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>

                <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calcIsFastPos}
                    onChange={(e) => setCalcIsFastPos(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
                  />
                  <span>Positive FAST Ultrasound in &ge;1 Window (+1)</span>
                </label>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-400">MTP Indication: </span>
                <span className={`font-bold ${((calcIsPenetrating ? 1 : 0) + (calcSbp <= 90 ? 1 : 0) + (calcHr >= 120 ? 1 : 0) + (calcIsFastPos ? 1 : 0)) >= 2 ? "text-rose-400" : "text-emerald-400"}`}>
                  {((calcIsPenetrating ? 1 : 0) + (calcSbp <= 90 ? 1 : 0) + (calcHr >= 120 ? 1 : 0) + (calcIsFastPos ? 1 : 0)) >= 2
                    ? "MTP ACTIVATION MANDATORY (>= 80% Massive Transfusion Probability)"
                    : "Standard Resuscitation Protocol"}
                </span>
              </div>
            </div>

            {/* Calculator 2: Lethal Triad Risk Evaluator */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-amber-400" />
                  Trauma Lethal Triad Surveillance
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white block">1. Hypothermia</span>
                    <span className="text-slate-400 text-[11px]">Core Temperature &lt; 35.0°C impairs coagulant enzymes</span>
                  </div>
                  <span className={`font-bold ${currentPatient.coreTemperatureC < 35.5 ? "text-rose-400" : "text-emerald-400"}`}>
                    {currentPatient.coreTemperatureC}°C
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white block">2. Acidosis</span>
                    <span className="text-slate-400 text-[11px]">pH &lt; 7.20 reduces factor Xa/Va activity by 70%</span>
                  </div>
                  <span className={`font-bold ${currentPatient.arterialPh < 7.25 ? "text-rose-400" : "text-emerald-400"}`}>
                    pH {currentPatient.arterialPh}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white block">3. Coagulopathy</span>
                    <span className="text-slate-400 text-[11px]">TEG R-Time &gt; 8 min / LY30 &gt; 3% hyperfibrinolysis</span>
                  </div>
                  <span className={`font-bold ${currentPatient.tegLy30Percent > 3.0 ? "text-rose-400" : "text-emerald-400"}`}>
                    LY30: {currentPatient.tegLy30Percent}%
                  </span>
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
              {/* Code 1: MTP */}
              <div className="bg-rose-950/20 border border-rose-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
                    <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
                    Code Massive Transfusion (MTP)
                  </div>
                  <p className="text-xs text-slate-300">
                    Emergency blood bank activation for rapid cavitary exsanguination or ABC score &ge; 2.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• Deploy Cooler 1 (4 PRBC, 4 FFP, 1 Plt)</div>
                    <div>• 1g IV TXA within 3 hours of injury</div>
                    <div>• Rapid Belmont Infuser @ 40.5°C</div>
                    <div>• Check $iCa^{2+}$ q4 units (1g CaCl2 prn)</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_MTP_ACTIVATION")}
                  className="mt-6 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition"
                >
                  Activate MTP Protocol
                </button>
              </div>

              {/* Code 2: REBOA */}
              <div className="bg-indigo-950/20 border border-indigo-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2">
                    <Radio className="w-5 h-5 text-indigo-400" />
                    Code REBOA Aortic Occlusion
                  </div>
                  <p className="text-xs text-slate-300">
                    Resuscitative Endovascular Balloon Occlusion for non-compressible torso hemorrhage.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• Zone I: Descending Aorta (Diaphragm to celiac)</div>
                    <div>• Zone III: Distal Aorta (Bifurcation for pelvis)</div>
                    <div>• Strict Occlusion Timer &lt; 30 min</div>
                    <div>• Immediate transfer to Operating Suite</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_REBOA_DEPLOYMENT")}
                  className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition"
                >
                  Activate REBOA Protocol
                </button>
              </div>

              {/* Code 3: Damage Control Surgery */}
              <div className="bg-amber-950/20 border border-amber-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                    <Workflow className="w-5 h-5 text-amber-500" />
                    Code Damage Control Laparotomy
                  </div>
                  <p className="text-xs text-slate-300">
                    Abbreviated surgical laparotomy with packing for refractory shock and lethal triad.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• 4-Quadrant surgical packing</div>
                    <div>• Temporary vascular shunts</div>
                    <div>• Temporary abdominal closure (Bogota/Abthera)</div>
                    <div>• ICU resuscitation & warming</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_DAMAGE_CONTROL_SURGERY")}
                  className="mt-6 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/30 transition"
                >
                  Activate Damage Control
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
       * MODAL: Blood Product Dispenser
       * ───────────────────────────────────────────────────────────── */}
      {isProductReleaseModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-rose-400" />
                Trauma Blood Product Dispenser
              </h3>
              <button
                onClick={() => setIsProductReleaseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAdministerBloodProduct("PRBC")}
                  className="p-3 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">+2 Units PRBC</span>
                  <span className="text-[10px] text-slate-400">Rapid Warmer Infusion</span>
                </button>
                <button
                  onClick={() => handleAdministerBloodProduct("FFP")}
                  className="p-3 bg-slate-950 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">+2 Units FFP</span>
                  <span className="text-[10px] text-slate-400">Thawed Fresh Plasma</span>
                </button>
                <button
                  onClick={() => handleAdministerBloodProduct("PLATELETS")}
                  className="p-3 bg-slate-950 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">+1 Unit Platelets</span>
                  <span className="text-[10px] text-slate-400">Apheresis Unit</span>
                </button>
                <button
                  onClick={() => handleAdministerBloodProduct("CALCIUM")}
                  className="p-3 bg-slate-950 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-600 rounded-xl text-left transition"
                >
                  <span className="font-bold text-white block">+1g Calcium Chloride</span>
                  <span className="text-[10px] text-slate-400">Correct Citrate Binding</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsProductReleaseModalOpen(false)}
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
                HL7 FHIR R4 DeviceObservation Bundle Preview
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
                <p className="text-xs text-rose-200">Emergency Protocol Broadcast to Trauma Team & Blood Bank</p>
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-rose-800 text-xs space-y-2 text-rose-100">
              <p>• Blood Bank MTP Rapid Dispatch Initialized.</p>
              <p>• Trauma Operating Room 1 Cleared for Damage Control.</p>
              <p>• Anesthesia & Interventional Radiology on Bay Standby.</p>
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
