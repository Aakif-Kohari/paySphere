import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  Brain,
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
  Eye,
  Radio,
  Flame,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * TypeScript Interfaces & Constants
 * ───────────────────────────────────────────────────────────── */

export type SIBICCTier = "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
export type LundbergWave = "A_WAVES" | "B_WAVES" | "C_WAVES";

export interface NeuroPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  diagnosis: string;
  admissionDate: string;
  daysInNeuroICU: number;
  marshallCTGrade: string;
  gcsEye: number;
  gcsVerbal: number;
  gcsMotor: number;
  gcsTotal: number;
  fourScoreEye: number;
  fourScoreMotor: number;
  fourScoreBrainstem: number;
  fourScoreRespiration: number;
  fourScoreTotal: number;
  icpMmHg: number;
  mapMmHg: number;
  cppMmHg: number;
  optimalCppMmHg: number;
  prxAutoregulationIndex: number;
  pbtO2MmHg: number;
  brainTempC: number;
  coreTempC: number;
  pupilLeftSizeMm: number;
  pupilRightSizeMm: number;
  npiLeft: number;
  npiRight: number;
  evdStatus: "OPEN_DRAINING" | "CLAMPED_MONITORING" | "NO_EVD";
  evdHeightCmH2O: number;
  evdOutputPerHourMl: number;
  tcdVmcaLeft: number;
  tcdVmcaRight: number;
  tcdLindegaardRatio: number;
  tcdPulsatilityIndex: number;
  microdialysisLPR: number;
  microdialysisGlucoseMmol: number;
  microdialysisGlycerolUmol: number;
  ceegBurstSuppressionPercent: number;
  ceegAlphaDeltaRatio: number;
  ceegSeizureBurdenPercent: number;
  lundbergWaveType: LundbergWave;
  sedationAgent: string;
  sedationDose: string;
  hyperosmolarAgent: string;
  serumSodiumMeqL: number;
  serumOsmolalityMOsmKg: number;
  currentSIBICCTier: SIBICCTier;
  clinicalStatus: string;
}

export interface TelemetryDataPoint {
  timestamp: string;
  tick: number;
  icp: number;
  map: number;
  cpp: number;
  pbtO2: number;
  prx: number;
  npiLeft: number;
  npiRight: number;
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
  category: "ICP_MANAGEMENT" | "SIBICC_TIER" | "OSMOTHERAPY" | "EVD_DRAINAGE" | "EMERGENCY_PROTOCOL" | "SYSTEM";
  action: string;
  deltaSummary: string;
  sha256Signature: string;
}

const INITIAL_PATIENTS: NeuroPatient[] = [
  {
    id: "PT-NEURO-9401",
    name: "Commander Gabriel Sterling",
    mrn: "MRN-8823901",
    age: 42,
    gender: "Male",
    weightKg: 82,
    heightCm: 183,
    diagnosis: "Severe Traumatic Brain Injury (sTBI) with Right Epidural & Contusional Hemorrhage",
    admissionDate: "2026-08-20T14:15:00Z",
    daysInNeuroICU: 2.3,
    marshallCTGrade: "Type III (High Risk Swelling)",
    gcsEye: 1,
    gcsVerbal: 1,
    gcsMotor: 3,
    gcsTotal: 5,
    fourScoreEye: 1,
    fourScoreMotor: 2,
    fourScoreBrainstem: 3,
    fourScoreRespiration: 1,
    fourScoreTotal: 7,
    icpMmHg: 23.4,
    mapMmHg: 88.0,
    cppMmHg: 64.6,
    optimalCppMmHg: 68.0,
    prxAutoregulationIndex: 0.38,
    pbtO2MmHg: 18.2,
    brainTempC: 37.8,
    coreTempC: 37.4,
    pupilLeftSizeMm: 3.2,
    pupilRightSizeMm: 4.8,
    npiLeft: 3.6,
    npiRight: 1.8,
    evdStatus: "OPEN_DRAINING",
    evdHeightCmH2O: 10,
    evdOutputPerHourMl: 14.5,
    tcdVmcaLeft: 92,
    tcdVmcaRight: 148,
    tcdLindegaardRatio: 4.2,
    tcdPulsatilityIndex: 1.45,
    microdialysisLPR: 34.2,
    microdialysisGlucoseMmol: 0.92,
    microdialysisGlycerolUmol: 142,
    ceegBurstSuppressionPercent: 0,
    ceegAlphaDeltaRatio: 0.95,
    ceegSeizureBurdenPercent: 4.0,
    lundbergWaveType: "B_WAVES",
    sedationAgent: "Propofol + Fentanyl",
    sedationDose: "50 mcg/kg/min + 100 mcg/hr",
    hyperosmolarAgent: "3% Hypertonic Saline @ 50 mL/hr",
    serumSodiumMeqL: 149,
    serumOsmolalityMOsmKg: 312,
    currentSIBICCTier: "TIER_1",
    clinicalStatus: "HIGH_ALERT_INTRACRANIAL_HYPERTENSION",
  },
  {
    id: "PT-NEURO-9402",
    name: "Dr. Vivienne Chen, PhD",
    mrn: "MRN-7734190",
    age: 51,
    gender: "Female",
    weightKg: 64,
    heightCm: 165,
    diagnosis: "Aneurysmal Subarachnoid Hemorrhage (aSAH Hunt-Hess 4, Fisher 3) s/p ACoA Coiling",
    admissionDate: "2026-08-17T09:30:00Z",
    daysInNeuroICU: 5.5,
    marshallCTGrade: "Diffuse Injury II",
    gcsEye: 2,
    gcsVerbal: 2,
    gcsMotor: 4,
    gcsTotal: 8,
    fourScoreEye: 2,
    fourScoreMotor: 3,
    fourScoreBrainstem: 4,
    fourScoreRespiration: 2,
    fourScoreTotal: 11,
    icpMmHg: 16.8,
    mapMmHg: 104.0,
    cppMmHg: 87.2,
    optimalCppMmHg: 75.0,
    prxAutoregulationIndex: 0.12,
    pbtO2MmHg: 28.5,
    brainTempC: 37.0,
    coreTempC: 36.9,
    pupilLeftSizeMm: 2.8,
    pupilRightSizeMm: 2.7,
    npiLeft: 4.4,
    npiRight: 4.2,
    evdStatus: "CLAMPED_MONITORING",
    evdHeightCmH2O: 15,
    evdOutputPerHourMl: 6.0,
    tcdVmcaLeft: 188,
    tcdVmcaRight: 215,
    tcdLindegaardRatio: 6.4,
    tcdPulsatilityIndex: 1.18,
    microdialysisLPR: 22.4,
    microdialysisGlucoseMmol: 1.85,
    microdialysisGlycerolUmol: 68,
    ceegBurstSuppressionPercent: 0,
    ceegAlphaDeltaRatio: 1.62,
    ceegSeizureBurdenPercent: 0.0,
    lundbergWaveType: "C_WAVES",
    sedationAgent: "Dexmedetomidine",
    sedationDose: "0.8 mcg/kg/hr",
    hyperosmolarAgent: "Isotonic Saline Maintenance",
    serumSodiumMeqL: 142,
    serumOsmolalityMOsmKg: 295,
    currentSIBICCTier: "TIER_0",
    clinicalStatus: "SEVERE_VASOSPASM_INDUCED_HTN_ACTIVE",
  },
  {
    id: "PT-NEURO-9403",
    name: "Julian Vance, JD",
    mrn: "MRN-6619082",
    age: 63,
    gender: "Male",
    weightKg: 89,
    heightCm: 176,
    diagnosis: "Large Left Middle Cerebral Artery (MCA) Malignant Infarction s/p Decompressive Hemicraniectomy",
    admissionDate: "2026-08-19T20:00:00Z",
    daysInNeuroICU: 3.1,
    marshallCTGrade: "Surgically Evacuated Mass Lesion",
    gcsEye: 1,
    gcsVerbal: 1,
    gcsMotor: 2,
    gcsTotal: 4,
    fourScoreEye: 1,
    fourScoreMotor: 1,
    fourScoreBrainstem: 2,
    fourScoreRespiration: 0,
    fourScoreTotal: 4,
    icpMmHg: 28.6,
    mapMmHg: 92.0,
    cppMmHg: 63.4,
    optimalCppMmHg: 72.0,
    prxAutoregulationIndex: 0.54,
    pbtO2MmHg: 13.8,
    brainTempC: 38.2,
    coreTempC: 37.9,
    pupilLeftSizeMm: 5.4,
    pupilRightSizeMm: 3.0,
    npiLeft: 0.0,
    npiRight: 2.2,
    evdStatus: "OPEN_DRAINING",
    evdHeightCmH2O: 5,
    evdOutputPerHourMl: 22.0,
    tcdVmcaLeft: 42,
    tcdVmcaRight: 88,
    tcdLindegaardRatio: 2.1,
    tcdPulsatilityIndex: 1.95,
    microdialysisLPR: 48.5,
    microdialysisGlucoseMmol: 0.45,
    microdialysisGlycerolUmol: 280,
    ceegBurstSuppressionPercent: 72,
    ceegAlphaDeltaRatio: 0.42,
    ceegSeizureBurdenPercent: 18.5,
    lundbergWaveType: "A_WAVES",
    sedationAgent: "Pentobarbital Infusion + Midazolam",
    sedationDose: "3.5 mg/kg/hr + 0.3 mg/kg/hr",
    hyperosmolarAgent: "23.4% Hypertonic Saline Boluses PRN",
    serumSodiumMeqL: 156,
    serumOsmolalityMOsmKg: 328,
    currentSIBICCTier: "TIER_3",
    clinicalStatus: "CRITICAL_REFRACTORY_ICP_BARBITURATE_COMA",
  },
];

/* ─────────────────────────────────────────────────────────────
 * Main Component Definition
 * ───────────────────────────────────────────────────────────── */

export default function NeurocriticalCareTelemetryPage(): JSX.Element {
  const [patients, setPatients] = useState<NeuroPatient[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("PT-NEURO-9401");
  const [activeTab, setActiveTab] = useState<"telemetry" | "sibicc" | "calculators" | "emergency" | "audit">("telemetry");
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryDataPoint[]>([]);
  const [, setTickCounter] = useState<number>(0);
  const [alarms, setAlarms] = useState<ClinicalAlarm[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeEmergencyProtocol, setActiveEmergencyProtocol] = useState<string | null>(null);
  const [isFHIRModalOpen, setIsFHIRModalOpen] = useState<boolean>(false);
  const [isOsmotherapyModalOpen, setIsOsmotherapyModalOpen] = useState<boolean>(false);
  const [customOsmolarAgent, setCustomOsmolarAgent] = useState<"MANNITOL_20" | "HYPERTONIC_SALINE_3">("HYPERTONIC_SALINE_3");

  // GCS & FOUR interactive calculator states
  const [calcGcsEye, setCalcGcsEye] = useState<number>(1);
  const [calcGcsVerbal, setCalcGcsVerbal] = useState<number>(1);
  const [calcGcsMotor, setCalcGcsMotor] = useState<number>(3);
  const [calcFourEye, setCalcFourEye] = useState<number>(1);
  const [calcFourMotor, setCalcFourMotor] = useState<number>(2);
  const [calcFourBrainstem, setCalcFourBrainstem] = useState<number>(3);
  const [calcFourResp, setCalcFourResp] = useState<number>(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  // Initialize Audit Log and Alarms on mount
  useEffect(() => {
    const initialLogs: AuditLogEntry[] = [
      {
        id: "AUD-NEURO-001",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        operator: "Dr. Alistair Vance, MD (Neurocritical Attending)",
        category: "SIBICC_TIER",
        action: "Escalated SIBICC Protocol to Tier 1",
        deltaSummary: "ICP sustained > 23 mmHg. Commenced 3% Hypertonic Saline and opened EVD at 10 cmH2O.",
        sha256Signature: "8f4a9b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
      },
      {
        id: "AUD-NEURO-002",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        operator: "Sarah Jenkins, BSN, CCRN (Neuro ICU Lead)",
        category: "EVD_DRAINAGE",
        action: "EVD Height Leveling & Patency Verification",
        deltaSummary: "Leveling confirmed at Foramen of Monro (Tragus). Drained 14.5 mL clear xanthochromic CSF.",
        sha256Signature: "4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c48f4a9b2c3d4e5f60718293a",
      },
    ];
    setAuditLogs(initialLogs);

    const initialAlarms: ClinicalAlarm[] = [
      {
        id: "ALM-001",
        timestamp: new Date().toISOString(),
        code: "BTF_ICP_ELEVATION",
        severity: "CRITICAL",
        title: "Intracranial Hypertension (ICP > 22 mmHg)",
        message: "Real-time parenchymal ICP is 23.4 mmHg. Compensatory intracranial volume exhausted.",
        action: "Inspect EVD drain, confirm HOB 30°, bolus hypertonic saline.",
        acknowledged: false,
      },
      {
        id: "ALM-002",
        timestamp: new Date().toISOString(),
        code: "PBTO2_BRAIN_HYPOXIA",
        severity: "HIGH_RISK",
        title: "Brain Tissue Hypoxia (PbtO2 < 20 mmHg)",
        message: "Licox sensor reports PbtO2 at 18.2 mmHg indicating ischemic metabolic penumbra.",
        action: "Titrate CPP to > 68 mmHg, ensure arterial PaO2 > 100 mmHg.",
        acknowledged: false,
      },
    ];
    setAlarms(initialAlarms);

    const initialHist: TelemetryDataPoint[] = [];
    for (let i = 20; i >= 0; i--) {
      initialHist.push({
        timestamp: new Date(Date.now() - i * 3000).toISOString(),
        tick: -i,
        icp: currentPatient.icpMmHg + (Math.sin(i) * 1.2),
        map: currentPatient.mapMmHg + (Math.cos(i) * 2.0),
        cpp: currentPatient.cppMmHg + (Math.cos(i) * 1.5),
        pbtO2: currentPatient.pbtO2MmHg + (Math.sin(i * 0.5) * 0.8),
        prx: currentPatient.prxAutoregulationIndex + (Math.sin(i * 0.3) * 0.05),
        npiLeft: currentPatient.npiLeft,
        npiRight: currentPatient.npiRight,
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

          const noiseIcp = (Math.random() - 0.48) * 0.4;
          const noiseMap = (Math.random() - 0.5) * 0.8;
          const newIcp = Math.max(4, Number((pt.icpMmHg + noiseIcp).toFixed(1)));
          const newMap = Math.max(50, Number((pt.mapMmHg + noiseMap).toFixed(1)));
          const newCpp = Number((newMap - newIcp).toFixed(1));
          const newPbtO2 = Math.max(5, Number((pt.pbtO2MmHg + (Math.random() - 0.5) * 0.2).toFixed(1)));
          const newPrx = Math.max(-0.8, Math.min(0.9, Number((pt.prxAutoregulationIndex + (Math.random() - 0.5) * 0.02).toFixed(2))));

          return {
            ...pt,
            icpMmHg: newIcp,
            mapMmHg: newMap,
            cppMmHg: newCpp,
            pbtO2MmHg: newPbtO2,
            prxAutoregulationIndex: newPrx,
          };
        })
      );

      setTelemetryHistory((prev) => {
        const last = prev[prev.length - 1] || {
          icp: currentPatient.icpMmHg,
          map: currentPatient.mapMmHg,
          cpp: currentPatient.cppMmHg,
          pbtO2: currentPatient.pbtO2MmHg,
          prx: currentPatient.prxAutoregulationIndex,
          npiLeft: currentPatient.npiLeft,
          npiRight: currentPatient.npiRight,
        };

        const newPoint: TelemetryDataPoint = {
          timestamp: new Date().toISOString(),
          tick: (last.tick || 0) + 1,
          icp: currentPatient.icpMmHg,
          map: currentPatient.mapMmHg,
          cpp: currentPatient.cppMmHg,
          pbtO2: currentPatient.pbtO2MmHg,
          prx: currentPatient.prxAutoregulationIndex,
          npiLeft: currentPatient.npiLeft,
          npiRight: currentPatient.npiRight,
        };

        const updated = [...prev, newPoint];
        return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isLiveStreaming, simulationSpeed, selectedPatientId, currentPatient]);

  // High-Resolution Oscilloscope Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      phase += 0.08 * simulationSpeed;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

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

      ctx.strokeStyle = currentPatient.icpMmHg > 22 ? "#f43f5e" : "#06b6d4";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const baseIcpY = height * 0.45;
      const scaleIcp = 2.8;

      for (let x = 0; x < width; x++) {
        const t = (x / 30) - phase;
        const cardiacCycle = t % (2 * Math.PI);
        let pulseHeight = 0;
        if (cardiacCycle > 0 && cardiacCycle < 1.8) {
          const p1 = Math.sin(cardiacCycle * 3.5) * 16;
          const p2Factor = currentPatient.icpMmHg > 20 ? 1.4 : 0.8;
          const p2 = Math.sin((cardiacCycle - 0.4) * 3.0) * (14 * p2Factor);
          const p3 = Math.sin((cardiacCycle - 0.8) * 2.5) * 8;
          pulseHeight = Math.max(0, p1 + p2 + p3);
        }

        const respiratoryWave = Math.sin(t * 0.2) * (currentPatient.lundbergWaveType === "B_WAVES" ? 12 : 3);
        const y = baseIcpY - (currentPatient.icpMmHg * scaleIcp) + pulseHeight - respiratoryWave;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const basePbto2Y = height * 0.85;
      for (let x = 0; x < width; x++) {
        const t = (x / 40) - (phase * 0.5);
        const oxygenTrend = Math.sin(t * 0.15) * 5;
        const y = basePbto2Y - (currentPatient.pbtO2MmHg * 2.0) + oxygenTrend;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText("CH1: PARENCHYMAL ICP PULSE (P1/P2/P3) [mmHg]", 12, 22);
      ctx.fillStyle = "#10b981";
      ctx.fillText("CH2: BRAIN TISSUE OXYGENATION (PbtO2) [mmHg]", 12, height - 12);

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

  const handleTierChange = (newTier: SIBICCTier) => {
    setPatients((prev) =>
      prev.map((pt) => (pt.id === selectedPatientId ? { ...pt, currentSIBICCTier: newTier } : pt))
    );
    const newLog: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: "Clinical Neuro-Intensivist On-Duty",
      category: "SIBICC_TIER",
      action: `Updated SIBICC Protocol to ${newTier}`,
      deltaSummary: `Patient transitioned to ${newTier}. Clinical checklist activated.`,
      sha256Signature: Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleEVDAdjustment = (status: "OPEN_DRAINING" | "CLAMPED_MONITORING" | "NO_EVD", height: number) => {
    setPatients((prev) =>
      prev.map((pt) =>
        pt.id === selectedPatientId ? { ...pt, evdStatus: status, evdHeightCmH2O: height } : pt
      )
    );
    const newLog: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: "Neurocritical Care Specialist",
      category: "EVD_DRAINAGE",
      action: `EVD Set to ${status} @ ${height} cmH2O`,
      deltaSummary: `Ventricular drainage transducer adjusted to ${height} cmH2O relative to Foramen of Monro.`,
      sha256Signature: Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const triggerHyperosmolarBolus = () => {
    setIsOsmotherapyModalOpen(false);
    const agentName = customOsmolarAgent === "MANNITOL_20" ? "Mannitol 20% (1.0 g/kg IV)" : "3% Hypertonic Saline (250 mL IV)";
    setPatients((prev) =>
      prev.map((pt) => {
        if (pt.id !== selectedPatientId) return pt;
        const reducedIcp = Math.max(12, Number((pt.icpMmHg - 4.5).toFixed(1)));
        const elevatedNa = pt.serumSodiumMeqL + (customOsmolarAgent === "HYPERTONIC_SALINE_3" ? 3 : 0);
        return {
          ...pt,
          icpMmHg: reducedIcp,
          serumSodiumMeqL: elevatedNa,
          serumOsmolalityMOsmKg: pt.serumOsmolalityMOsmKg + 6,
        };
      })
    );

    const newLog: AuditLogEntry = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operator: "Neuro ICU Intensivist",
      category: "OSMOTHERAPY",
      action: `Administered Hyperosmolar Bolus: ${agentName}`,
      deltaSummary: "Osmotherapy administered. Expected ICP reduction of 4-6 mmHg and serum sodium elevation.",
      sha256Signature: Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const exportTelemetryCSV = () => {
    const headers = ["Timestamp", "Tick", "ICP_mmHg", "MAP_mmHg", "CPP_mmHg", "PbtO2_mmHg", "PRx_Index", "NPi_Left", "NPi_Right"];
    const rows = telemetryHistory.map((pt) => [
      pt.timestamp,
      pt.tick,
      pt.icp,
      pt.map,
      pt.cpp,
      pt.pbtO2,
      pt.prx,
      pt.npiLeft,
      pt.npiRight,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Neurocritical_Telemetry_${currentPatient.id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateFHIRBundle = () => {
    return {
      resourceType: "Bundle",
      id: `bundle-neuro-${currentPatient.id}-${Date.now()}`,
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: `obs-icp-${Date.now()}`,
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "60955-2", display: "Intracranial pressure" }],
            },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.icpMmHg, unit: "mmHg" },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: `obs-cpp-${Date.now()}`,
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "74780-8", display: "Cerebral perfusion pressure" }],
            },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.cppMmHg, unit: "mmHg" },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: `obs-pbto2-${Date.now()}`,
            status: "final",
            code: {
              coding: [{ system: "http://loinc.org", code: "85354-9", display: "Brain tissue oxygen tension" }],
            },
            subject: { reference: `Patient/${currentPatient.id}`, display: currentPatient.name },
            effectiveDateTime: new Date().toISOString(),
            valueQuantity: { value: currentPatient.pbtO2MmHg, unit: "mmHg" },
          },
        },
      ],
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
       * Top Telemetry Header Bar
       * ───────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
              <Brain className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Neurocritical Care & Multimodal Neuromonitoring
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
                  BTF 4th Ed / SIBICC Tiered
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Parenchymal ICP • PRx Autoregulation • Licox PbtO2 • NPi Pupillometry • TCD Vasospasm • cEEG
              </p>
            </div>
          </div>

          {/* Control Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                aria-label="Select Neurocritical Patient"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-cyan-500 focus:outline-none appearance-none font-medium cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.mrn}) — {p.marshallCTGrade}
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
                      ? "bg-cyan-600 text-white shadow-sm"
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
              <span className="text-slate-400">Diagnosis: </span>
              <span className="font-semibold text-cyan-300">{currentPatient.diagnosis}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400">Marshall CT: </span>
              <span className="font-semibold text-amber-400">{currentPatient.marshallCTGrade}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">GCS Score:</span>
              <span className="px-2 py-0.5 rounded font-bold bg-rose-950 text-rose-400 border border-rose-800">
                {currentPatient.gcsTotal} / 15 (E{currentPatient.gcsEye}V{currentPatient.gcsVerbal}M{currentPatient.gcsMotor})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">FOUR Score:</span>
              <span className="px-2 py-0.5 rounded font-bold bg-purple-950 text-purple-400 border border-purple-800">
                {currentPatient.fourScoreTotal} / 16
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">SIBICC Protocol:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-cyan-950 text-cyan-400 border border-cyan-700">
                {currentPatient.currentSIBICCTier}
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
          {/* Card 1: Intracranial Pressure (ICP) */}
          <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
            currentPatient.icpMmHg > 22
              ? "bg-rose-950/20 border-rose-600/50 shadow-lg shadow-rose-950/40"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                Intracranial Pressure (ICP)
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                currentPatient.lundbergWaveType === "A_WAVES"
                  ? "bg-rose-900 text-rose-200 animate-pulse"
                  : currentPatient.lundbergWaveType === "B_WAVES"
                  ? "bg-amber-900 text-amber-200"
                  : "bg-slate-800 text-slate-300"
              }`}>
                {currentPatient.lundbergWaveType}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${
                currentPatient.icpMmHg > 22 ? "text-rose-400 animate-pulse" : "text-white"
              }`}>
                {currentPatient.icpMmHg.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-400">mmHg</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Target: &le; 20 mmHg</span>
              <span className={currentPatient.icpMmHg > 22 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                {currentPatient.icpMmHg > 22 ? "CRITICAL HYPERTENSION" : "OPTIMAL COMPLIANCE"}
              </span>
            </div>
          </div>

          {/* Card 2: Cerebral Perfusion Pressure (CPP) & PRx */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-indigo-400" />
                Cerebral Perfusion (CPP)
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                currentPatient.prxAutoregulationIndex > 0.3
                  ? "bg-rose-950 text-rose-400 border border-rose-800"
                  : "bg-emerald-950 text-emerald-400 border border-emerald-800"
              }`}>
                PRx: {currentPatient.prxAutoregulationIndex > 0.3 ? "IMPAIRED" : "INTACT"}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{currentPatient.cppMmHg.toFixed(1)}</span>
              <span className="text-xs font-medium text-slate-400">mmHg</span>
              <span className="text-xs text-slate-400 ml-auto">CPPopt: {currentPatient.optimalCppMmHg}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>MAP: {currentPatient.mapMmHg.toFixed(1)} mmHg</span>
              <span className="text-indigo-300 font-medium">PRx: {currentPatient.prxAutoregulationIndex.toFixed(2)}</span>
            </div>
          </div>

          {/* Card 3: Brain Tissue Oxygen (PbtO2) */}
          <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
            currentPatient.pbtO2MmHg < 20
              ? "bg-amber-950/20 border-amber-600/50 shadow-lg shadow-amber-950/40"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-emerald-400" />
                Brain Tissue O2 (PbtO2)
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                Licox Probe
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${
                currentPatient.pbtO2MmHg < 15
                  ? "text-rose-400 animate-pulse"
                  : currentPatient.pbtO2MmHg < 20
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}>
                {currentPatient.pbtO2MmHg.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-400">mmHg</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Target: &ge; 25 mmHg</span>
              <span className={currentPatient.pbtO2MmHg < 20 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                {currentPatient.pbtO2MmHg < 15 ? "SEVERE ISCHEMIA" : currentPatient.pbtO2MmHg < 20 ? "BRAIN HYPOXIA" : "NORMIC TISSUE"}
              </span>
            </div>
          </div>

          {/* Card 4: Quantitative Pupillometry (NPi) */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-purple-400" />
                Quantitative Pupillometry
              </span>
              <span className="text-[10px] text-purple-300 font-semibold">NPi Score</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">OS (Left)</div>
                <div className="text-lg font-bold text-white flex items-baseline gap-1">
                  {currentPatient.pupilLeftSizeMm}mm
                  <span className={`text-xs font-black ${currentPatient.npiLeft < 3 ? "text-amber-400" : "text-emerald-400"}`}>
                    NPi {currentPatient.npiLeft}
                  </span>
                </div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">OD (Right)</div>
                <div className="text-lg font-bold text-white flex items-baseline gap-1">
                  {currentPatient.pupilRightSizeMm}mm
                  <span className={`text-xs font-black ${
                    currentPatient.npiRight === 0 ? "text-rose-400 animate-pulse" : currentPatient.npiRight < 3 ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    NPi {currentPatient.npiRight}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-800/80 pt-1.5">
              <span>Anisocoria: {Math.abs(currentPatient.pupilLeftSizeMm - currentPatient.pupilRightSizeMm).toFixed(1)} mm</span>
              <span className={Math.abs(currentPatient.pupilLeftSizeMm - currentPatient.pupilRightSizeMm) >= 1.0 ? "text-amber-400 font-semibold" : "text-slate-400"}>
                {Math.abs(currentPatient.pupilLeftSizeMm - currentPatient.pupilRightSizeMm) >= 1.0 ? "ASYMMETRY ALERT" : "SYMMETRIC"}
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * Secondary Multimodal Row (TCD, EVD, cEEG, Microdialysis)
         * ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">TCD MCA Sonography</span>
              <span className="text-indigo-400 font-mono">LR {currentPatient.tcdLindegaardRatio}</span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>R: {currentPatient.tcdVmcaRight} cm/s</span>
              <span>L: {currentPatient.tcdVmcaLeft} cm/s</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {currentPatient.tcdLindegaardRatio >= 6.0
                ? "Severe Vasospasm (Induced HTN protocol)"
                : currentPatient.tcdLindegaardRatio >= 3.0
                ? "Moderate Vasospasm"
                : "Hyperemia / Baseline Flow"}
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">EVD Ventriculostomy</span>
              <span className={`font-bold ${currentPatient.evdStatus === "OPEN_DRAINING" ? "text-emerald-400" : "text-amber-400"}`}>
                {currentPatient.evdStatus}
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Level: {currentPatient.evdHeightCmH2O} cmH2O</span>
              <span>Rate: {currentPatient.evdOutputPerHourMl} mL/hr</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Tragus Zeroing • Clear Xanthochromic</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">cEEG Electrophysiology</span>
              <span className="text-cyan-400 font-mono">ADR {currentPatient.ceegAlphaDeltaRatio}</span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Burst Supp: {currentPatient.ceegBurstSuppressionPercent}%</span>
              <span>Ictal: {currentPatient.ceegSeizureBurdenPercent}%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">21-Channel 10-20 Montage Active</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span className="font-semibold text-slate-300">Microdialysis Markers</span>
              <span className={`font-mono font-bold ${currentPatient.microdialysisLPR > 30 ? "text-rose-400" : "text-emerald-400"}`}>
                LPR {currentPatient.microdialysisLPR}
              </span>
            </div>
            <div className="flex items-center justify-between text-white font-bold text-sm">
              <span>Gluc: {currentPatient.microdialysisGlucoseMmol} mM</span>
              <span>Glyc: {currentPatient.microdialysisGlycerolUmol} &mu;M</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {currentPatient.microdialysisLPR > 40 ? "Severe Mitochondrial Distress" : "Aerobic Metabolism"}
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
         * Navigation Tab Switcher
         * ───────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: "telemetry", label: "Multimodal Telemetry & Waveforms", icon: Activity },
            { id: "sibicc", label: "SIBICC Tiered Step-Ladder Protocol", icon: Layers },
            { id: "calculators", label: "Neuro Scores & Osmotherapy Engine", icon: SlidersHorizontal },
            { id: "emergency", label: "Emergency Rescue Action Stations", icon: ShieldAlert },
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
                    ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
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
         * TAB 1: Multimodal Telemetry & High-Res Waveforms
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-950 text-cyan-400 rounded-lg border border-cyan-800">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Continuous Intracranial Waveform Analyzer & PbtO2 Real-Time Stream
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time pulse morphology (P1 percussion, P2 tidal, P3 dicrotic peaks) and respiratory baseline drift
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Sample Rate: 250 Hz</span>
                  <button
                    onClick={() => setIsOsmotherapyModalOpen(true)}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5"
                  >
                    <Syringe className="w-3.5 h-3.5" />
                    Bolus Osmotherapy
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <canvas ref={canvasRef} width={980} height={260} className="w-full h-[260px] block" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-cyan-400 block mb-1">P1 vs P2 Morphology Index</span>
                  <p className="text-slate-400 text-[11px]">
                    {currentPatient.icpMmHg > 20
                      ? "P2 > P1: Significant loss of intracranial compliance. Intracranial reserve volume exhausted."
                      : "P1 > P2: Normal arterial transmission. Normal compensatory reserve."}
                  </p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-indigo-400 block mb-1">Pressure Reactivity (PRx)</span>
                  <p className="text-slate-400 text-[11px]">
                    PRx = {currentPatient.prxAutoregulationIndex.toFixed(2)}.{" "}
                    {currentPatient.prxAutoregulationIndex > 0.3
                      ? "Vasodilatory paralysis. Avoid aggressive MAP drops."
                      : "Active arteriolar vasoconstriction intact."}
                  </p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-emerald-400 block mb-1">PbtO2 Tissue Oxygen Index</span>
                  <p className="text-slate-400 text-[11px]">
                    {currentPatient.pbtO2MmHg < 20
                      ? "Cellular hypoxia detected. SIBICC hypoxia protocol indicated."
                      : "Adequate capillary diffusion and tissue oxygen tension."}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Active Neuro-Critical Telemetry Alarms ({alarms.filter((a) => !a.acknowledged).length})
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
                        <p className="text-[11px] text-cyan-400 font-medium mt-1">Recommended Action: {alarm.action}</p>
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
         * TAB 2: SIBICC Tiered Step-Ladder Protocol
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "sibicc" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    Seattle International Severe TBI Consensus (SIBICC) Protocol Step-Ladder
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Standardized tiered escalation algorithm for severe intracranial hypertension and brain tissue hypoxia
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Current Status:</span>
                  <span className="px-3 py-1 bg-cyan-950 text-cyan-400 font-bold text-xs rounded-lg border border-cyan-700">
                    {currentPatient.currentSIBICCTier}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Tier 0 */}
                <div className={`p-4 rounded-xl border transition ${
                  currentPatient.currentSIBICCTier === "TIER_0"
                    ? "bg-cyan-950/30 border-cyan-500/80 shadow-lg shadow-cyan-950/40"
                    : "bg-slate-950/50 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center text-xs font-black">
                        0
                      </span>
                      Tier 0: Foundational Neuro-Protective Care
                    </span>
                    <button
                      onClick={() => handleTierChange("TIER_0")}
                      className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                    >
                      Set Active
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 mt-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Head of Bed elevated 30° with neutral neck alignment
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Target core normothermia (36.0 - 37.5°C)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Normovolemia & Serum Sodium 140-145 mEq/L
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Maintain MAP &ge; 80 mmHg (Target CPP 60-70)
                    </li>
                  </ul>
                </div>

                {/* Tier 1 */}
                <div className={`p-4 rounded-xl border transition ${
                  currentPatient.currentSIBICCTier === "TIER_1"
                    ? "bg-cyan-950/30 border-cyan-500/80 shadow-lg shadow-cyan-950/40"
                    : "bg-slate-950/50 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center text-xs font-black">
                        1
                      </span>
                      Tier 1: Early ICP & Hypoxia Escalation (ICP &gt; 22 mmHg)
                    </span>
                    <button
                      onClick={() => handleTierChange("TIER_1")}
                      className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                    >
                      Set Active
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 mt-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      Open EVD for CSF drainage (10-15 cmH2O)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      Hyperosmolar boluses (Mannitol 20% or 3% Saline)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      Target Serum Osmolality 300-320 mOsm/kg
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      Neuromuscular test bolus for ventilator synchrony
                    </li>
                  </ul>
                </div>

                {/* Tier 2 */}
                <div className={`p-4 rounded-xl border transition ${
                  currentPatient.currentSIBICCTier === "TIER_2"
                    ? "bg-amber-950/30 border-amber-500/80 shadow-lg shadow-amber-950/40"
                    : "bg-slate-950/50 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-amber-300 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-900 text-amber-300 flex items-center justify-center text-xs font-black">
                        2
                      </span>
                      Tier 2: Refractory Intracranial Hypertension Escalation
                    </span>
                    <button
                      onClick={() => handleTierChange("TIER_2")}
                      className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                    >
                      Set Active
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 mt-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Continuous Neuromuscular Blockade (Cisatracurium)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Mild hyperventilation (Target PaCO2 30-35 mmHg)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Hyperosmolar target Na 150-155 mEq/L
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      PRx-guided individualized optimal CPP titration
                    </li>
                  </ul>
                </div>

                {/* Tier 3 */}
                <div className={`p-4 rounded-xl border transition ${
                  currentPatient.currentSIBICCTier === "TIER_3"
                    ? "bg-rose-950/30 border-rose-500/80 shadow-lg shadow-rose-950/40"
                    : "bg-slate-950/50 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-rose-300 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rose-900 text-rose-300 flex items-center justify-center text-xs font-black">
                        3
                      </span>
                      Tier 3: Salvage Refractory Interventions
                    </span>
                    <button
                      onClick={() => handleTierChange("TIER_3")}
                      className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                    >
                      Set Active
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 mt-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      Barbiturate Coma Therapy (Pentobarbital EEG burst suppression)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      Emergent Decompressive Craniectomy Evaluation
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      Moderate Therapeutic Hypothermia (32.0 - 34.0°C)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      Profound hyperventilation strictly as bridge to OR
                    </li>
                  </ul>
                </div>
              </div>

              {/* Interactive EVD Controller Section */}
              <div className="mt-8 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-cyan-400" />
                  EVD Transducer & Drainage Command Control
                </h4>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <button
                    onClick={() => handleEVDAdjustment("OPEN_DRAINING", 10)}
                    className="px-3 py-2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg hover:bg-emerald-900 font-semibold"
                  >
                    Open Drain @ 10 cmH2O
                  </button>
                  <button
                    onClick={() => handleEVDAdjustment("OPEN_DRAINING", 5)}
                    className="px-3 py-2 bg-amber-950 text-amber-300 border border-amber-800 rounded-lg hover:bg-amber-900 font-semibold"
                  >
                    Open Drain @ 5 cmH2O (Aggressive Decompression)
                  </button>
                  <button
                    onClick={() => handleEVDAdjustment("CLAMPED_MONITORING", 15)}
                    className="px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-700 font-semibold"
                  >
                    Clamp for Continuous ICP Waveform
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 3: Neuro-Scores & Osmotherapy Calculators
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "calculators" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calculator 1: GCS Score Engine */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  Glasgow Coma Scale (GCS) Calculator
                </h3>
                <span className="text-lg font-black text-rose-400">
                  Total: {calcGcsEye + calcGcsVerbal + calcGcsMotor} / 15
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Eye Opening Response (1-4)</label>
                  <select
                    aria-label="Eye Opening Response"
                    value={calcGcsEye}
                    onChange={(e) => setCalcGcsEye(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={4}>4 - Spontaneous</option>
                    <option value={3}>3 - To Sound / Voice</option>
                    <option value={2}>2 - To Pressure / Pain</option>
                    <option value={1}>1 - None</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Verbal Response (1-5)</label>
                  <select
                    aria-label="Verbal Response"
                    value={calcGcsVerbal}
                    onChange={(e) => setCalcGcsVerbal(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={5}>5 - Oriented</option>
                    <option value={4}>4 - Confused</option>
                    <option value={3}>3 - Inappropriate Words</option>
                    <option value={2}>2 - Incomprehensible Sounds</option>
                    <option value={1}>1 - None / Intubated</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Motor Response (1-6)</label>
                  <select
                    aria-label="Motor Response"
                    value={calcGcsMotor}
                    onChange={(e) => setCalcGcsMotor(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={6}>6 - Obeys Commands</option>
                    <option value={5}>5 - Localizes to Pain</option>
                    <option value={4}>4 - Normal Flexion (Withdrawal)</option>
                    <option value={3}>3 - Abnormal Flexion (Decorticate)</option>
                    <option value={2}>2 - Extension (Decerebrate)</option>
                    <option value={1}>1 - None / Flaccid</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-400">Classification: </span>
                <span className="font-bold text-amber-400">
                  {calcGcsEye + calcGcsVerbal + calcGcsMotor <= 8
                    ? "Severe Traumatic Brain Injury (sTBI) — Intubation & ICP monitoring indicated"
                    : calcGcsEye + calcGcsVerbal + calcGcsMotor <= 12
                    ? "Moderate Brain Injury"
                    : "Mild Brain Injury"}
                </span>
              </div>
            </div>

            {/* Calculator 2: FOUR Score Engine */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  FOUR (Full Outline of UnResponsiveness) Score
                </h3>
                <span className="text-lg font-black text-purple-400">
                  Total: {calcFourEye + calcFourMotor + calcFourBrainstem + calcFourResp} / 16
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Eye Responses (0-4)</label>
                  <select
                    aria-label="Eye Responses"
                    value={calcFourEye}
                    onChange={(e) => setCalcFourEye(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={4}>4 - Eyelids open or opened, tracking or blinking to command</option>
                    <option value={3}>3 - Eyelids open but not tracking</option>
                    <option value={2}>2 - Eyelids closed but open to loud voice</option>
                    <option value={1}>1 - Eyelids closed but open to pain</option>
                    <option value={0}>0 - Eyelids remain closed with pain</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Motor Responses (0-4)</label>
                  <select
                    aria-label="Motor Responses"
                    value={calcFourMotor}
                    onChange={(e) => setCalcFourMotor(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={4}>4 - Thumbs-up, fist, or peace sign</option>
                    <option value={3}>3 - Localizing to pain</option>
                    <option value={2}>2 - Flexion response to pain</option>
                    <option value={1}>1 - Extension response to pain</option>
                    <option value={0}>0 - No response to pain / generalized myoclonus</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Brainstem Reflexes (0-4)</label>
                  <select
                    aria-label="Brainstem Reflexes"
                    value={calcFourBrainstem}
                    onChange={(e) => setCalcFourBrainstem(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={4}>4 - Pupillary and corneal reflexes present</option>
                    <option value={3}>3 - One pupil wide and fixed</option>
                    <option value={2}>2 - Pupillary OR corneal reflexes absent</option>
                    <option value={1}>1 - Pupillary AND corneal reflexes absent</option>
                    <option value={0}>0 - Absent pupil, corneal, and cough reflex</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Respiration Pattern (0-4)</label>
                  <select
                    aria-label="Respiration Pattern"
                    value={calcFourResp}
                    onChange={(e) => setCalcFourResp(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={4}>4 - Not intubated, regular breathing pattern</option>
                    <option value={3}>3 - Not intubated, Cheyne-Stokes breathing pattern</option>
                    <option value={2}>2 - Not intubated, irregular breathing</option>
                    <option value={1}>1 - Intubated, breathes above ventilator rate</option>
                    <option value={0}>0 - Intubated, breathes at ventilator rate or apnea</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
         * TAB 4: Emergency Protocols & Action Stations
         * ───────────────────────────────────────────────────────────── */}
        {activeTab === "emergency" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Code 1: Brain Herniation */}
              <div className="bg-rose-950/20 border border-rose-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-2">
                    <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
                    Code Brain Herniation
                  </div>
                  <p className="text-xs text-slate-300">
                    Impending uncal or transtentorial herniation with blown pupil (NPi=0) or Cushing triad.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• 23.4% NaCl (30 mL IV push) or Mannitol (1.5 g/kg)</div>
                    <div>• Hyperventilate PaCO2 28-32 mmHg (Bridge)</div>
                    <div>• Open EVD to 0 cmH2O</div>
                    <div>• Alert Neurosurgery STAT for Craniectomy</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_BRAIN_HERNIATION")}
                  className="mt-6 w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition"
                >
                  Activate Herniation Protocol
                </button>
              </div>

              {/* Code 2: Refractory Status Epilepticus */}
              <div className="bg-amber-950/20 border border-amber-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Code Status Epilepticus (RSE)
                  </div>
                  <p className="text-xs text-slate-300">
                    Persistent electrographic or clinical seizure activity &gt; 5 min refractory to first-line agents.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• IV Lorazepam 0.1 mg/kg + Levetiracetam 60 mg/kg</div>
                    <div>• Propofol (2-5 mg/kg/hr) or Midazolam infusion</div>
                    <div>• Titrate cEEG to 60-80% Burst Suppression</div>
                    <div>• Vasopressor support for BP stability</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_STATUS_EPILEPTICUS")}
                  className="mt-6 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/30 transition"
                >
                  Activate RSE Protocol
                </button>
              </div>

              {/* Code 3: Severe Vasospasm / DCI */}
              <div className="bg-indigo-950/20 border border-indigo-600/60 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2">
                    <Radio className="w-5 h-5 text-indigo-400" />
                    Code Vasospasm / DCI Rescue
                  </div>
                  <p className="text-xs text-slate-300">
                    Aneurysmal SAH delayed cerebral ischemia with TCD Lindegaard Ratio &gt; 6.0 or focal deficit.
                  </p>
                  <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                    <div>• Induced Hypertension (Target SBP 160-180)</div>
                    <div>• Strict Euvolemia (Avoid hypervolemia)</div>
                    <div>• Oral Nimodipine 60 mg q4h verification</div>
                    <div>• Interventional Angioplasty / Intra-arterial Milrinone</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveEmergencyProtocol("CODE_VASOSPASM_DCI")}
                  className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition"
                >
                  Activate Vasospasm Protocol
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
                  <FileText className="w-5 h-5 text-cyan-400" />
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
                        <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-cyan-400 border border-slate-800">
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
       * MODAL: Hyperosmolar Titration Inspector
       * ───────────────────────────────────────────────────────────── */}
      {isOsmotherapyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Syringe className="w-5 h-5 text-cyan-400" />
                Hyperosmolar Bolus Dosing Calculator
              </h3>
              <button
                onClick={() => setIsOsmotherapyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Select Osmolar Agent</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCustomOsmolarAgent("HYPERTONIC_SALINE_3")}
                    className={`p-3 rounded-xl border text-left font-semibold transition ${
                      customOsmolarAgent === "HYPERTONIC_SALINE_3"
                        ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    3% Hypertonic Saline
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      250 mL IV bolus over 15 min
                    </span>
                  </button>
                  <button
                    onClick={() => setCustomOsmolarAgent("MANNITOL_20")}
                    className={`p-3 rounded-xl border text-left font-semibold transition ${
                      customOsmolarAgent === "MANNITOL_20"
                        ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Mannitol 20%
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      1.0 g/kg (350-400 mL)
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span>Current Serum Sodium:</span>
                  <span className="font-bold text-white">{currentPatient.serumSodiumMeqL} mEq/L</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Serum Osmolality:</span>
                  <span className="font-bold text-white">{currentPatient.serumOsmolalityMOsmKg} mOsm/kg</span>
                </div>
                <div className="flex justify-between">
                  <span>Calculated Dose:</span>
                  <span className="font-bold text-cyan-400">
                    {customOsmolarAgent === "MANNITOL_20" ? `${currentPatient.weightKg * 1.0} g (20% solution)` : "250 mL of 3% NaCl"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsOsmotherapyModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={triggerHyperosmolarBolus}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30"
              >
                Authorize & Administer Bolus
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
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-cyan-300 max-h-96 overflow-y-auto">
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
       * MODAL: Emergency Protocol Active Confirmation
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
                <p className="text-xs text-rose-200">Emergency Protocol Broadcast to Rapid Response Team</p>
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-rose-800 text-xs space-y-2 text-rose-100">
              <p>• Neurosurgical On-Call Intensivist Paged.</p>
              <p>• Operating Room standby alert dispatched.</p>
              <p>• Bedside nursing alert chime activated.</p>
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
