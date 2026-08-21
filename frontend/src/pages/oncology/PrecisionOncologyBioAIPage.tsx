import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dna,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Microscope,
  FileText,
  Layers,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Info,
  X,
  Target,
  Sparkles,
  FlaskConical,
  Atom,
  Clock,
  UserCheck,
  Stethoscope,
  Share2,
  Eye,
  Sliders,
  Flame,
  Binary,
  Radio,
  FileCheck2,
  HeartPulse,
} from "lucide-react";

export type CancerType =
  | "NSCLC Adenocarcinoma"
  | "Metastatic Colorectal Cancer"
  | "Triple-Negative Breast Cancer"
  | "Pancreatic Ductal Adenocarcinoma"
  | "Cutaneous Melanoma"
  | "Glioblastoma Multiforme"
  | "Acute Myeloid Leukemia";

export type ActionabilityTier =
  | "Tier I (Strong Evidence)"
  | "Tier II (Potential)"
  | "Tier III (VUS)"
  | "Tier IV (Benign)";

export type ESCATLevel =
  | "ESCAT I-A"
  | "ESCAT I-B"
  | "ESCAT II-A"
  | "ESCAT II-B"
  | "ESCAT III"
  | "ESCAT IV";

export type VariantType =
  | "SNV"
  | "INDEL"
  | "CNV Amplification"
  | "Gene Fusion"
  | "Splice Site";

export interface GenomicVariant {
  id: string;
  gene: string;
  hgvsc: string;
  hgvsp: string;
  variantType: VariantType;
  vaf: number;
  readDepth: number;
  tier: ActionabilityTier;
  escat: ESCATLevel;
  pathogenicity: "Pathogenic" | "Likely Pathogenic" | "VUS" | "Likely Benign";
  clinsig: string;
  actionableTherapy: string[];
  resistanceMarkers: string[];
  cosmicId: string;
  gnomadFreq: number;
}

export interface LiquidBiopsyPoint {
  date: string;
  ctDNAFraction: number;
  mutantCopiesPerMl: number;
  targetGene: string;
  status: "Clearing" | "Stable" | "Molecular Progression" | "Recurrence Risk";
}

export interface ClinicalTrialMatch {
  nctId: string;
  title: string;
  phase: "Phase I" | "Phase I/II" | "Phase II" | "Phase III";
  biomarkerCriteria: string;
  matchingScore: number;
  locations: string[];
  sponsor: string;
  contact: string;
}

export interface OncologyPatientProfile {
  id: string;
  patientName: string;
  mrn: string;
  age: number;
  gender: "Female" | "Male" | "Other";
  diagnosis: CancerType;
  stage: "Stage I" | "Stage II" | "Stage III" | "Stage IV (Metastatic)";
  ecogScore: 0 | 1 | 2 | 3 | 4;
  tmb: number;
  tmbStatus: "TMB-High (>=10)" | "TMB-Low (<10)";
  msiStatus: "MSI-High" | "MSS (Stable)" | "MSI-Low";
  hrdScore: number;
  pdl1Tps: number;
  liquidBiopsyTrend: LiquidBiopsyPoint[];
  variants: GenomicVariant[];
  trials: ClinicalTrialMatch[];
  aiRecommendations: string[];
  activeRegimen: string;
  priorLinesCount: number;
  protocolAlerts: string[];
  riskCategory: "CRITICAL ESCALATION" | "ELEVATED RISK" | "TARGETABLE STABLE" | "OPTIMAL RESPONSE";
}

export interface TumorBoardDecisionLog {
  id: string;
  timestamp: string;
  patientId: string;
  oncologist: string;
  proposedIntervention: string;
  consensusStatus: "UNANIMOUS" | "MAJORITY" | "PENDING REVIEW" | "REJECTED";
  actionItems: string[];
  rationale: string;
}

const INITIAL_PATIENTS: OncologyPatientProfile[] = [
  {
    id: "PT-ONC-8812",
    patientName: "Eleanor Vance",
    mrn: "MRN-784019",
    age: 58,
    gender: "Female",
    diagnosis: "NSCLC Adenocarcinoma",
    stage: "Stage IV (Metastatic)",
    ecogScore: 1,
    tmb: 14.8,
    tmbStatus: "TMB-High (>=10)",
    msiStatus: "MSS (Stable)",
    hrdScore: 32,
    pdl1Tps: 65,
    activeRegimen: "Osimertinib 80mg daily + Pemetrexed maintenance",
    priorLinesCount: 2,
    riskCategory: "CRITICAL ESCALATION",
    protocolAlerts: [
      "Molecular Resistance Detected: EGFR C797S emergence (VAF 18.4%) in trans with T790M",
      "High ctDNA surge (+340 copies/mL) over 14-day interval signaling secondary progression",
      "Recommend Immediate Molecular Tumor Board Escalation for MET / Dual-TKIs Trial Match",
    ],
    aiRecommendations: [
      "NCCN Guideline Category 1: Evaluate combination Amivantamab + Lazertinib or BLU-945 4th-gen EGFR TKI trial.",
      "Liquid Biopsy ctDNA clearance monitoring recommended every 14 days under FDA 21 CFR Part 11 audit.",
      "Check for MET amplification co-alteration via FISH or targeted NGS panel.",
    ],
    variants: [
      {
        id: "VAR-101",
        gene: "EGFR",
        hgvsc: "c.2573T>G",
        hgvsp: "p.Leu858Arg (L858R)",
        variantType: "SNV",
        vaf: 48.2,
        readDepth: 1420,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-A",
        pathogenicity: "Pathogenic",
        clinsig: "Therapeutic Sensitivity to 1st/3rd Gen TKIs",
        actionableTherapy: ["Osimertinib", "Erlotinib", "Gefitinib"],
        resistanceMarkers: ["EGFR C797S", "MET amp"],
        cosmicId: "COSM6224",
        gnomadFreq: 0.00001,
      },
      {
        id: "VAR-102",
        gene: "EGFR",
        hgvsc: "c.2369C>T",
        hgvsp: "p.Thr790Met (T790M)",
        variantType: "SNV",
        vaf: 31.6,
        readDepth: 1250,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-A",
        pathogenicity: "Pathogenic",
        clinsig: "Gatekeeper Resistance to 1st/2nd Gen TKIs; Sensitive to Osimertinib",
        actionableTherapy: ["Osimertinib"],
        resistanceMarkers: ["EGFR C797S"],
        cosmicId: "COSM6240",
        gnomadFreq: 0.000004,
      },
      {
        id: "VAR-103",
        gene: "EGFR",
        hgvsc: "c.2389T>A",
        hgvsp: "p.Cys797Ser (C797S)",
        variantType: "SNV",
        vaf: 18.4,
        readDepth: 980,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-B",
        pathogenicity: "Pathogenic",
        clinsig: "Acquired Osimertinib Resistance in trans/cis configuration",
        actionableTherapy: ["Amivantamab + Lazertinib", "Brigatinib + Cetuximab (if trans)"],
        resistanceMarkers: ["All covalent 3rd-Gen TKIs"],
        cosmicId: "COSM1451600",
        gnomadFreq: 0.0,
      },
      {
        id: "VAR-104",
        gene: "TP53",
        hgvsc: "c.743G>A",
        hgvsp: "p.Arg248Gln (R248Q)",
        variantType: "SNV",
        vaf: 54.1,
        readDepth: 1600,
        tier: "Tier II (Potential)",
        escat: "ESCAT II-A",
        pathogenicity: "Pathogenic",
        clinsig: "Dominant-negative DNA contact mutant; associated with worse PFS",
        actionableTherapy: ["Investigational APR-246 (Eprenetapopt)"],
        resistanceMarkers: [],
        cosmicId: "COSM10656",
        gnomadFreq: 0.00002,
      },
    ],
    liquidBiopsyTrend: [
      { date: "2026-06-01", ctDNAFraction: 1.2, mutantCopiesPerMl: 45, targetGene: "EGFR L858R", status: "Clearing" },
      { date: "2026-06-28", ctDNAFraction: 0.8, mutantCopiesPerMl: 28, targetGene: "EGFR L858R", status: "Clearing" },
      { date: "2026-07-20", ctDNAFraction: 2.4, mutantCopiesPerMl: 110, targetGene: "EGFR T790M", status: "Stable" },
      { date: "2026-08-10", ctDNAFraction: 7.9, mutantCopiesPerMl: 480, targetGene: "EGFR C797S", status: "Molecular Progression" },
    ],
    trials: [
      {
        nctId: "NCT05286431",
        title: "Phase II Study of Next-Gen Allosteric EGFR Inhibitor in C797S-Mutated NSCLC",
        phase: "Phase II",
        biomarkerCriteria: "EGFR L858R/T790M/C797S triple mutant after Osimertinib progression",
        matchingScore: 98,
        locations: ["Memorial Sloan Kettering, NY", "Dana-Farber Cancer Institute, MA"],
        sponsor: "BioGenomics Therapeutics",
        contact: "clinicaltrials@biogenomics.org",
      },
      {
        nctId: "NCT04982926",
        title: "Amivantamab and Lazertinib Combination in Advanced Non-Small Cell Lung Cancer",
        phase: "Phase III",
        biomarkerCriteria: "EGFR-mutated NSCLC refractory to Osimertinib monotherapy",
        matchingScore: 92,
        locations: ["MD Anderson Cancer Center, TX", "Mayo Clinic, MN"],
        sponsor: "Janssen R&D",
        contact: "trials@janssen.com",
      },
    ],
  },
  {
    id: "PT-ONC-9405",
    patientName: "Marcus Thorne",
    mrn: "MRN-492104",
    age: 64,
    gender: "Male",
    diagnosis: "Metastatic Colorectal Cancer",
    stage: "Stage IV (Metastatic)",
    ecogScore: 0,
    tmb: 28.4,
    tmbStatus: "TMB-High (>=10)",
    msiStatus: "MSI-High",
    hrdScore: 18,
    pdl1Tps: 45,
    activeRegimen: "Pembrolizumab 200mg Q3W + Regorafenib",
    priorLinesCount: 1,
    riskCategory: "OPTIMAL RESPONSE",
    protocolAlerts: [
      "MSI-High / dMMR Confirmed: Complete molecular response sustained on Anti-PD-1 checkpoint therapy",
      "ctDNA zero-clearance maintained over last two consecutive monitoring cycles",
    ],
    aiRecommendations: [
      "NCCN Keynote-177 Protocol: Continue Single-Agent Pembrolizumab 200mg IV Q3W up to 24 months.",
      "Check for immune-related adverse events (irAE) colitis/thyroiditis panel bi-weekly.",
    ],
    variants: [
      {
        id: "VAR-201",
        gene: "BRAF",
        hgvsc: "c.1799T>A",
        hgvsp: "p.Val600Glu (V600E)",
        variantType: "SNV",
        vaf: 8.1,
        readDepth: 1840,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-A",
        pathogenicity: "Pathogenic",
        clinsig: "Encorafenib + Cetuximab sensitivity; MSI-H overrides poor prognosis under IO",
        actionableTherapy: ["Encorafenib + Cetuximab", "Pembrolizumab (due to MSI-H)"],
        resistanceMarkers: ["Panitumumab monotherapy"],
        cosmicId: "COSM476",
        gnomadFreq: 0.0,
      },
      {
        id: "VAR-202",
        gene: "MLH1",
        hgvsc: "c.677G>A",
        hgvsp: "p.Arg226Gln (R226Q)",
        variantType: "SNV",
        vaf: 49.5,
        readDepth: 1100,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-A",
        pathogenicity: "Pathogenic",
        clinsig: "Mismatch Repair Deficiency (dMMR); Germline Lynch Syndrome risk",
        actionableTherapy: ["Immune Checkpoint Blockade (Pembrolizumab / Nivolumab)"],
        resistanceMarkers: [],
        cosmicId: "COSM26123",
        gnomadFreq: 0.000008,
      },
      {
        id: "VAR-203",
        gene: "PIK3CA",
        hgvsc: "c.1633G>A",
        hgvsp: "p.Glu545Lys (E545K)",
        variantType: "SNV",
        vaf: 14.3,
        readDepth: 1350,
        tier: "Tier II (Potential)",
        escat: "ESCAT II-A",
        pathogenicity: "Pathogenic",
        clinsig: "Constitutive PI3K/Akt pathway activation; potential Alpelisib synergy",
        actionableTherapy: ["Alpelisib + Cetuximab (Trial)"],
        resistanceMarkers: [],
        cosmicId: "COSM763",
        gnomadFreq: 0.000012,
      },
    ],
    liquidBiopsyTrend: [
      { date: "2026-05-15", ctDNAFraction: 12.8, mutantCopiesPerMl: 820, targetGene: "BRAF V600E", status: "Stable" },
      { date: "2026-06-18", ctDNAFraction: 3.1, mutantCopiesPerMl: 140, targetGene: "BRAF V600E", status: "Clearing" },
      { date: "2026-07-22", ctDNAFraction: 0.2, mutantCopiesPerMl: 8, targetGene: "BRAF V600E", status: "Clearing" },
      { date: "2026-08-18", ctDNAFraction: 0.0, mutantCopiesPerMl: 0, targetGene: "BRAF V600E", status: "Clearing" },
    ],
    trials: [
      {
        nctId: "NCT04655456",
        title: "Targeted Triplet: Encorafenib + Cetuximab + Nivolumab in BRAF V600E Colorectal",
        phase: "Phase II",
        biomarkerCriteria: "BRAF V600E mutation with microsatellite instability or mismatch repair deficiency",
        matchingScore: 95,
        locations: ["Fred Hutchinson Cancer Center, WA", "City of Hope, CA"],
        sponsor: "National Cancer Institute (NCI)",
        contact: "nci-trials@nih.gov",
      },
    ],
  },
  {
    id: "PT-ONC-7319",
    patientName: "Sophia Al-Mansoor",
    mrn: "MRN-902341",
    age: 46,
    gender: "Female",
    diagnosis: "Triple-Negative Breast Cancer",
    stage: "Stage III",
    ecogScore: 1,
    tmb: 8.6,
    tmbStatus: "TMB-Low (<10)",
    msiStatus: "MSS (Stable)",
    hrdScore: 68,
    pdl1Tps: 80,
    activeRegimen: "Sacituzumab Govitecan 10mg/kg + Olaparib (Trial arm)",
    priorLinesCount: 2,
    riskCategory: "TARGETABLE STABLE",
    protocolAlerts: [
      "High HRD Score (68/100) indicates significant Genomic Scarring and PARP Inhibitor synthetic lethality vulnerability",
      "BRCA1 Germline pathogenic deletion (c.68_69delAG) confirmed by clinical genetics",
    ],
    aiRecommendations: [
      "ESMO Clinical Recommendation: PARP inhibitor maintenance (Olaparib or Talazoparib) exhibits synthetic lethality.",
      "Antibody-Drug Conjugate (ADC) targeting TROP-2 (Sacituzumab Govitecan) provides superior progression-free survival.",
      "Cascade genetic testing strongly advised for first-degree relatives.",
    ],
    variants: [
      {
        id: "VAR-301",
        gene: "BRCA1",
        hgvsc: "c.68_69delAG",
        hgvsp: "p.Glu23ValfsTer17",
        variantType: "INDEL",
        vaf: 50.4,
        readDepth: 2100,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-A",
        pathogenicity: "Pathogenic",
        clinsig: "Deleterious Frameshift; Germline Predisposition + PARPi Sensitivity",
        actionableTherapy: ["Olaparib", "Talazoparib", "Carboplatin AUC 5"],
        resistanceMarkers: ["BRCA1 Reversion Mutations (secondary indels restoring reading frame)"],
        cosmicId: "COSM13834",
        gnomadFreq: 0.0001,
      },
      {
        id: "VAR-302",
        gene: "PIK3CA",
        hgvsc: "c.3140A>G",
        hgvsp: "p.His1047Arg (H1047R)",
        variantType: "SNV",
        vaf: 22.8,
        readDepth: 1720,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-B",
        pathogenicity: "Pathogenic",
        clinsig: "Kinase domain gain-of-function; candidate for Capivasertib / Alpelisib",
        actionableTherapy: ["Capivasertib + Fulvestrant", "Alpelisib"],
        resistanceMarkers: [],
        cosmicId: "COSM775",
        gnomadFreq: 0.000015,
      },
    ],
    liquidBiopsyTrend: [
      { date: "2026-05-10", ctDNAFraction: 8.4, mutantCopiesPerMl: 520, targetGene: "BRCA1 68_69delAG", status: "Stable" },
      { date: "2026-06-12", ctDNAFraction: 5.2, mutantCopiesPerMl: 310, targetGene: "BRCA1 68_69delAG", status: "Clearing" },
      { date: "2026-07-15", ctDNAFraction: 2.1, mutantCopiesPerMl: 95, targetGene: "BRCA1 68_69delAG", status: "Clearing" },
      { date: "2026-08-16", ctDNAFraction: 1.8, mutantCopiesPerMl: 70, targetGene: "BRCA1 68_69delAG", status: "Clearing" },
    ],
    trials: [
      {
        nctId: "NCT04588220",
        title: "Phase III Trial of Sacituzumab Govitecan combined with Talazoparib in BRCA-Deficient TNBC",
        phase: "Phase III",
        biomarkerCriteria: "gBRCA1/2 mutated or HRD-high metastatic TNBC refractory to taxanes",
        matchingScore: 97,
        locations: ["Johns Hopkins Sidney Kimmel Cancer Center, MD", "UCSF Helen Diller Center, CA"],
        sponsor: "Gilead Sciences / Pfizer",
        contact: "oncology-trials@gilead.com",
      },
    ],
  },
  {
    id: "PT-ONC-6022",
    patientName: "David K. Larson",
    mrn: "MRN-331908",
    age: 69,
    gender: "Male",
    diagnosis: "Cutaneous Melanoma",
    stage: "Stage IV (Metastatic)",
    ecogScore: 2,
    tmb: 42.1,
    tmbStatus: "TMB-High (>=10)",
    msiStatus: "MSS (Stable)",
    hrdScore: 12,
    pdl1Tps: 20,
    activeRegimen: "Ipilimumab 3mg/kg + Nivolumab 1mg/kg (Dual Checkpoint Blockade)",
    priorLinesCount: 0,
    riskCategory: "ELEVATED RISK",
    protocolAlerts: [
      "Hypermutated UV signature (TMB 42.1 mut/Mb) with NRAS Q61R driver mutation",
      "Grade 2 immune-related hepatitis alert: Transaminases ALT/AST > 3x ULN detected on latest panel",
    ],
    aiRecommendations: [
      "NCCN Guideline: Withhold Ipilimumab/Nivolumab; Initiate oral Prednisone 1mg/kg/day for irAE hepatitis.",
      "Upon resolution to Grade <=1, resume Nivolumab monotherapy maintenance.",
      "Evaluate MEK inhibitor Trametinib or Binimetinib as subsequent targeted option for NRAS driver.",
    ],
    variants: [
      {
        id: "VAR-401",
        gene: "NRAS",
        hgvsc: "c.182A>G",
        hgvsp: "p.Gln61Arg (Q61R)",
        variantType: "SNV",
        vaf: 39.2,
        readDepth: 1540,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-A",
        pathogenicity: "Pathogenic",
        clinsig: "GTPase locked in active state; BRAF-inhibitor resistant; MEK inhibitor candidate",
        actionableTherapy: ["Binimetinib", "MEK162 + CDK4/6i (Trial)"],
        resistanceMarkers: ["Vemurafenib / Dabrafenib (contraindicated due to paradoxical MAPK activation)"],
        cosmicId: "COSM563",
        gnomadFreq: 0.000002,
      },
      {
        id: "VAR-402",
        gene: "CDKN2A",
        hgvsc: "c.238C>T",
        hgvsp: "p.Arg80Ter (R80*)",
        variantType: "SNV",
        vaf: 44.0,
        readDepth: 1200,
        tier: "Tier I (Strong Evidence)",
        escat: "ESCAT I-B",
        pathogenicity: "Pathogenic",
        clinsig: "Loss of p16INK4a / p14ARF cell cycle checkpoint; CDK4/6 inhibitor rationale",
        actionableTherapy: ["Palbociclib / Abemaciclib (Investigational combination)"],
        resistanceMarkers: [],
        cosmicId: "COSM12543",
        gnomadFreq: 0.00001,
      },
    ],
    liquidBiopsyTrend: [
      { date: "2026-06-05", ctDNAFraction: 16.5, mutantCopiesPerMl: 1150, targetGene: "NRAS Q61R", status: "Stable" },
      { date: "2026-07-08", ctDNAFraction: 9.8, mutantCopiesPerMl: 620, targetGene: "NRAS Q61R", status: "Clearing" },
      { date: "2026-08-11", ctDNAFraction: 4.2, mutantCopiesPerMl: 210, targetGene: "NRAS Q61R", status: "Clearing" },
    ],
    trials: [
      {
        nctId: "NCT03973346",
        title: "Binimetinib Plus Ribociclib in Patients with NRAS-Mutant Advanced Melanoma",
        phase: "Phase II",
        biomarkerCriteria: "NRAS Q61/G12 mutation in metastatic melanoma after immune checkpoint failure",
        matchingScore: 93,
        locations: ["Roswell Park Comprehensive Cancer Center, NY", "UPMC Hillman, PA"],
        sponsor: "Novartis Pharmaceuticals",
        contact: "novartis-oncology@novartis.com",
      },
    ],
  },
];

const INITIAL_TUMOR_BOARD_LOGS: TumorBoardDecisionLog[] = [
  {
    id: "MTB-2026-0881",
    timestamp: "2026-08-21 14:30:00",
    patientId: "PT-ONC-8812",
    oncologist: "Dr. Alistair Sterling, MD, PhD (Molecular Oncology)",
    proposedIntervention: "Transition from Osimertinib to Amivantamab + Lazertinib dual-targeting trial protocol.",
    consensusStatus: "UNANIMOUS",
    actionItems: [
      "Order fast-track FISH testing for MET gene copy number",
      "Screen for Phase II Allosteric C797S TKI Trial (NCT05286431)",
      "Baseline echocardiogram and infusion toxicity consent",
    ],
    rationale:
      "Emergence of EGFR C797S at 18.4% VAF confirms structural blockade of covalent osimertinib binding. Combination therapy provides dual-epitope extracellular and allosteric kinase inhibition.",
  },
  {
    id: "MTB-2026-0882",
    timestamp: "2026-08-20 11:15:00",
    patientId: "PT-ONC-9405",
    oncologist: "Dr. Helena Chen, MD (Gastrointestinal Oncology)",
    proposedIntervention: "Continue monotherapy Pembrolizumab 200mg Q3W for cycle 14.",
    consensusStatus: "UNANIMOUS",
    actionItems: [
      "Schedule quarterly high-resolution CT chest/abdomen/pelvis",
      "Monitor ctDNA MRD zero-state maintenance",
    ],
    rationale:
      "Sustained molecular complete response with undetectable circulating tumor DNA in MSI-H colorectal carcinoma.",
  },
];

export default function PrecisionOncologyBioAIPage() {
  const [patients, setPatients] = useState<OncologyPatientProfile[]>(INITIAL_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(INITIAL_PATIENTS[0].id);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCancerFilter, setSelectedCancerFilter] = useState<string>("ALL");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "VARIANTS" | "LIQUID_BIOPSY" | "TRIALS" | "TUMOR_BOARD" | "DRUG_GENE"
  >("OVERVIEW");

  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [tickCounter, setTickCounter] = useState<number>(0);
  const [emergencyAlertActive, setEmergencyAlertActive] = useState<boolean>(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState<boolean>(false);
  const [activeModalVariant, setActiveModalVariant] = useState<GenomicVariant | null>(null);
  const [tumorBoardModalOpen, setTumorBoardModalOpen] = useState<boolean>(false);
  const [newActionItem, setNewActionItem] = useState<string>("");
  const [newRationale, setNewRationale] = useState<string>("");
  const [boardLogs, setBoardLogs] = useState<TumorBoardDecisionLog[]>(INITIAL_TUMOR_BOARD_LOGS);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.variants.some(
          (v) =>
            v.gene.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.hgvsp.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchCancer = selectedCancerFilter === "ALL" || p.diagnosis === selectedCancerFilter;
      return matchSearch && matchCancer;
    });
  }, [patients, searchQuery, selectedCancerFilter]);

  const activePatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0];
  }, [patients, selectedPatientId]);

  const filteredVariants = useMemo(() => {
    return activePatient.variants.filter((v) => {
      if (selectedTierFilter === "ALL") return true;
      return v.tier === selectedTierFilter;
    });
  }, [activePatient, selectedTierFilter]);

  useEffect(() => {
    if (!isSimulating) return;

    const intervalMs = 2500 / simSpeed;
    const interval = setInterval(() => {
      setTickCounter((prev) => prev + 1);

      setPatients((prevPatients) =>
        prevPatients.map((p) => {
          if (p.id === "PT-ONC-8812") {
            const lastPoint = p.liquidBiopsyTrend[p.liquidBiopsyTrend.length - 1];
            const deltaFrac = Math.random() * 0.4 - 0.1;
            const newFrac = Math.max(0.1, Number((lastPoint.ctDNAFraction + deltaFrac).toFixed(2)));
            const newCopies = Math.round(newFrac * 60 + (Math.random() * 20 - 10));

            const updatedHistory = [...p.liquidBiopsyTrend];
            if (updatedHistory.length > 8) updatedHistory.shift();

            const nextDate = new Date();
            const dateStr = nextDate.toISOString().split("T")[0];

            updatedHistory.push({
              date: dateStr,
              ctDNAFraction: newFrac,
              mutantCopiesPerMl: newCopies,
              targetGene: "EGFR C797S",
              status: newFrac > 5.0 ? "Molecular Progression" : "Stable",
            });

            return {
              ...p,
              liquidBiopsyTrend: updatedHistory,
            };
          }
          return p;
        })
      );
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isSimulating, simSpeed]);

  const handleResetSimulation = useCallback(() => {
    setPatients(INITIAL_PATIENTS);
    setTickCounter(0);
    setEmergencyAlertActive(false);
  }, []);

  const handleInjectEmergentResistance = useCallback(() => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === activePatient.id) {
          const novelVariant: GenomicVariant = {
            id: `VAR-EMERGENT-${Date.now()}`,
            gene: "MET",
            hgvsc: "c.3029C>T",
            hgvsp: "p.Thr1010Ile (T1010I amp)",
            variantType: "CNV Amplification",
            vaf: 28.5,
            readDepth: 1890,
            tier: "Tier I (Strong Evidence)",
            escat: "ESCAT I-B",
            pathogenicity: "Pathogenic",
            clinsig: "Emergent MET Amplification bypass track conferring complete osimertinib resistance",
            actionableTherapy: ["Capmatinib", "Tepotinib", "Savolitinib"],
            resistanceMarkers: ["EGFR monotherapy bypass"],
            cosmicId: "COSM12984",
            gnomadFreq: 0.0,
          };

          return {
            ...p,
            riskCategory: "CRITICAL ESCALATION",
            variants: [novelVariant, ...p.variants],
            protocolAlerts: [
              "CRITICAL BIO-AI ALERT: De novo MET Amplification detected at 28.5% copy level. Immediate dual-inhibition protocol indicated.",
              ...p.protocolAlerts,
            ],
          };
        }
        return p;
      })
    );
    setEmergencyAlertActive(true);
  }, [activePatient.id]);

  const handleTriggerEmergencyProtocol = useCallback(() => {
    setEmergencyAlertActive(true);
    setEmergencyModalOpen(true);
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = [
      "Patient ID",
      "Name",
      "MRN",
      "Diagnosis",
      "Stage",
      "TMB (mut/Mb)",
      "MSI Status",
      "HRD Score",
      "Gene",
      "HGVS.p",
      "VAF %",
      "Tier",
      "Actionable Drugs",
    ];

    const rows: string[] = [];
    patients.forEach((p) => {
      p.variants.forEach((v) => {
        rows.push(
          [
            p.id,
            `"${p.patientName}"`,
            p.mrn,
            `"${p.diagnosis}"`,
            p.stage,
            p.tmb,
            p.msiStatus,
            p.hrdScore,
            v.gene,
            `"${v.hgvsp}"`,
            v.vaf,
            `"${v.tier}"`,
            `"${v.actionableTherapy.join("; ")}"`,
          ].join(",")
        );
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("
");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `PaySphere_Precision_Oncology_Export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [patients]);

  const handleAddTumorBoardLog = useCallback(() => {
    if (!newActionItem.trim() || !newRationale.trim()) return;

    const newLog: TumorBoardDecisionLog = {
      id: `MTB-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      patientId: activePatient.id,
      oncologist: "Dr. Board Certified Molecular Oncologist",
      proposedIntervention: newActionItem,
      consensusStatus: "UNANIMOUS",
      actionItems: [newActionItem],
      rationale: newRationale,
    };

    setBoardLogs([newLog, ...boardLogs]);
    setNewActionItem("");
    setNewRationale("");
    setTumorBoardModalOpen(false);
  }, [newActionItem, newRationale, activePatient.id, boardLogs]);

  const getRiskBadge = (risk: OncologyPatientProfile["riskCategory"]) => {
    switch (risk) {
      case "CRITICAL ESCALATION":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-950/80 text-rose-400 border border-rose-800 animate-pulse flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> CRITICAL ESCALATION
          </span>
        );
      case "ELEVATED RISK":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> ELEVATED RISK
          </span>
        );
      case "TARGETABLE STABLE":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800 flex items-center gap-1">
            <Target className="w-3.5 h-3.5" /> TARGETABLE STABLE
          </span>
        );
      case "OPTIMAL RESPONSE":
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> OPTIMAL RESPONSE
          </span>
        );
    }
  };

  const getTierColor = (tier: ActionabilityTier) => {
    if (tier.includes("Tier I")) return "text-emerald-400 bg-emerald-950/60 border-emerald-800";
    if (tier.includes("Tier II")) return "text-cyan-400 bg-cyan-950/60 border-cyan-800";
    if (tier.includes("Tier III")) return "text-amber-400 bg-amber-950/60 border-amber-800";
    return "text-slate-400 bg-slate-900 border-slate-700";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 font-sans">
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl shadow-lg shadow-cyan-900/30">
              <Dna className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Precision Oncology & Bio-AI Genomics Station
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700">
                  HL7 FHIR R4 / NCCN v2026
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Real-Time Somatic NGS Variant Calling • ctDNA Liquid Biopsy Kinetics • Molecular Tumor Board Decision Support
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isSimulating ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isSimulating ? "Live Telemetry" : "Paused"}
            </button>

            <div className="flex items-center gap-1 px-2 border-l border-slate-800 ml-1">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSimSpeed(speed)}
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                    simSpeed === speed ? "bg-slate-700 text-cyan-300 font-bold" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <button
              onClick={handleResetSimulation}
              title="Reset Simulation State"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded ml-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleTriggerEmergencyProtocol}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/40 transition border border-rose-500"
          >
            <ShieldAlert className="w-4 h-4" />
            Molecular Code Red
          </button>

          <button
            onClick={handleInjectEmergentResistance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Inject MET Spike
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Export
          </button>
        </div>
      </header>

      {emergencyAlertActive && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-rose-950/90 via-rose-900/40 to-slate-950 border-2 border-rose-600 shadow-xl shadow-rose-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 rounded-lg text-white">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-rose-200 text-sm md:text-base flex items-center gap-2">
                CRITICAL MOLECULAR RESISTANCE & PROGRESSION PROTOCOL ACTIVATED
              </h3>
              <p className="text-xs text-rose-300/90 mt-0.5">
                Targetable resistance switch detected (EGFR C797S / MET amplification). Automated Clinical Trial matching and Molecular Tumor Board consensus escalation initiated under FDA 21 CFR Part 11 compliance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTumorBoardModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow"
            >
              Open Tumor Board Session
            </button>
            <button
              onClick={() => setEmergencyAlertActive(false)}
              className="p-1 text-rose-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Tumor Mutational Burden (TMB)</span>
            <Microscope className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">{activePatient.tmb}</span>
            <span className="text-xs text-slate-400">mut/Mb</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className={`font-semibold ${activePatient.tmb >= 10 ? "text-emerald-400" : "text-slate-400"}`}>
              {activePatient.tmbStatus}
            </span>
            <span className="text-slate-500 font-mono">FDA IO Biomarker</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Microsatellite Instability (MSI)</span>
            <Binary className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono ${
                activePatient.msiStatus === "MSI-High" ? "text-emerald-400" : "text-slate-200"
              }`}
            >
              {activePatient.msiStatus}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">PD-L1 TPS: {activePatient.pdl1Tps}%</span>
            <span className="text-slate-500 font-mono">IHC 22C3</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Homologous Recombination (HRD)</span>
            <Atom className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">{activePatient.hrdScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className={`font-semibold ${activePatient.hrdScore >= 42 ? "text-amber-400" : "text-slate-400"}`}>
              {activePatient.hrdScore >= 42 ? "PARPi Sensitive (High)" : "HR Proficient (Low)"}
            </span>
            <span className="text-slate-500 font-mono">MyChoice CDx</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>ctDNA Liquid Biopsy Dynamic</span>
            <HeartPulse className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">
              {activePatient.liquidBiopsyTrend[activePatient.liquidBiopsyTrend.length - 1]?.ctDNAFraction}%
            </span>
            <span className="text-xs text-slate-400">fraction</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-rose-300 font-medium">
              {activePatient.liquidBiopsyTrend[activePatient.liquidBiopsyTrend.length - 1]?.mutantCopiesPerMl} copies/mL
            </span>
            <span className="text-slate-500 font-mono">Tick #{tickCounter}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col h-[760px]">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Patient Cohort ({filteredPatients.length})</span>
              <FlaskConical className="w-4 h-4 text-cyan-400" />
            </h2>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, gene, MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            <select
              value={selectedCancerFilter}
              onChange={(e) => setSelectedCancerFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Cancer Subtypes</option>
              <option value="NSCLC Adenocarcinoma">NSCLC Adenocarcinoma</option>
              <option value="Metastatic Colorectal Cancer">Metastatic Colorectal Cancer</option>
              <option value="Triple-Negative Breast Cancer">Triple-Negative Breast Cancer</option>
              <option value="Cutaneous Melanoma">Cutaneous Melanoma</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredPatients.map((p) => {
              const isSelected = p.id === selectedPatientId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-800/90 border-cyan-500 ring-1 ring-cyan-500 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {p.patientName}
                        <span className="text-[10px] font-mono text-slate-400 font-normal">({p.mrn})</span>
                      </h4>
                      <p className="text-[11px] text-cyan-300/90 mt-0.5 font-medium">{p.diagnosis}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{p.stage.split(" ")[0]}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {p.variants.slice(0, 2).map((v) => (
                        <span
                          key={v.id}
                          className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-slate-300 border border-slate-700"
                        >
                          {v.gene}
                        </span>
                      ))}
                      {p.variants.length > 2 && (
                        <span className="text-[10px] text-slate-500 font-mono">+{p.variants.length - 2}</span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        p.riskCategory === "CRITICAL ESCALATION"
                          ? "bg-rose-950 text-rose-400"
                          : p.riskCategory === "ELEVATED RISK"
                          ? "bg-amber-950 text-amber-400"
                          : "bg-emerald-950 text-emerald-400"
                      }`}
                    >
                      {p.riskCategory.split(" ")[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md">
                {activePatient.patientName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{activePatient.patientName}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {activePatient.mrn}
                  </span>
                  <span className="text-xs text-slate-400">
                    {activePatient.age}yo {activePatient.gender} • ECOG: {activePatient.ecogScore}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-cyan-400">{activePatient.diagnosis}</span>
                  <span className="text-slate-500">•</span>
                  <span>{activePatient.stage}</span>
                  <span className="text-slate-500">•</span>
                  <span>
                    Active Line: <strong className="text-slate-200">{activePatient.activeRegimen}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {getRiskBadge(activePatient.riskCategory)}
              <button
                onClick={() => setTumorBoardModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow"
              >
                Log Tumor Board Note
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
            {[
              { id: "OVERVIEW", label: "Bio-AI Summary & Protocols", icon: Activity },
              { id: "VARIANTS", label: `Genomic Variants (${activePatient.variants.length})`, icon: Dna },
              { id: "LIQUID_BIOPSY", label: "ctDNA Kinetics Telemetry", icon: HeartPulse },
              { id: "TRIALS", label: `AI Trial Matching (${activePatient.trials.length})`, icon: Target },
              { id: "DRUG_GENE", label: "Drug-Gene Interaction Matrix", icon: FlaskConical },
              {
                id: "TUMOR_BOARD",
                label: `Molecular Board Logs (${
                  boardLogs.filter((b) => b.patientId === activePatient.id).length
                })`,
                icon: FileText,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-slate-900 text-cyan-300 border-t-2 border-cyan-400 border-x border-slate-800"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Active Clinical Triggers & Protocol Alerts ({activePatient.protocolAlerts.length})
                </h4>
                <div className="space-y-2">
                  {activePatient.protocolAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-200 flex items-start gap-2.5"
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-rose-300">Trigger #{idx + 1}: </span>
                        {alert}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  NCCN / ESMO Biomarker AI Guidance Engine
                </h4>
                <div className="space-y-2.5">
                  {activePatient.aiRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">{rec}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Prior Systemic Lines</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {activePatient.priorLinesCount} Lines
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Refractory to Standard Platinum Doublet</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Genomic Specimen Depth</span>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-1">1,450x NGS Mean</div>
                  <p className="text-[11px] text-slate-500 mt-1">523-Gene Comprehensive Panel</p>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Compliance & Security</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">FDA 21 CFR Part 11</div>
                  <p className="text-[11px] text-slate-500 mt-1">Audit Trail Signed & Timestamped</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "VARIANTS" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Somatic Next-Generation Sequencing Variants
                    <span className="text-xs font-mono text-cyan-400">
                      ({filteredVariants.length} detected)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Classified per AMP/ASCO/CAP Somatic Variant Guidelines</p>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedTierFilter}
                    onChange={(e) => setSelectedTierFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="ALL">All Actionability Tiers</option>
                    <option value="Tier I (Strong Evidence)">Tier I (Strong Evidence)</option>
                    <option value="Tier II (Potential)">Tier II (Potential Evidence)</option>
                    <option value="Tier III (VUS)">Tier III (VUS)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                      <th className="py-2.5 px-3">Gene & Alteration</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 font-mono">VAF %</th>
                      <th className="py-2.5 px-3">Tier / ESCAT</th>
                      <th className="py-2.5 px-3">Targeted Therapy Options</th>
                      <th className="py-2.5 px-3">Resistance Alerts</th>
                      <th className="py-2.5 px-3 text-right">Inspector</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredVariants.map((variant) => (
                      <tr key={variant.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-cyan-300 font-mono">{variant.gene}</div>
                          <div className="text-[11px] text-slate-300 font-mono">{variant.hgvsp}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{variant.hgvsc}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                            {variant.variantType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span className={variant.vaf >= 20 ? "text-amber-400" : "text-slate-300"}>
                              {variant.vaf}%
                            </span>
                            <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${variant.vaf >= 20 ? "bg-amber-400" : "bg-cyan-400"}`}
                                style={{ width: `${Math.min(variant.vaf, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-normal font-mono">
                            {variant.readDepth}x depth
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getTierColor(
                              variant.tier
                            )}`}
                          >
                            {variant.tier.split(" ")[0]} {variant.tier.split(" ")[1]}
                          </span>
                          <div className="text-[10px] text-indigo-400 font-mono mt-0.5 font-semibold">
                            {variant.escat}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {variant.actionableTherapy.map((drug, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[10px] border border-emerald-800"
                              >
                                {drug}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {variant.resistanceMarkers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {variant.resistanceMarkers.map((res, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 text-[10px] border border-rose-800"
                                >
                                  {res}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">None reported</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setActiveModalVariant(variant)}
                            className="p-1.5 text-cyan-400 hover:text-white hover:bg-slate-800 rounded transition"
                            title="Inspect Variant Evidence"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "LIQUID_BIOPSY" && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-rose-400" />
                      Serial ctDNA Liquid Biopsy Kinetics (Molecular Response Tracking)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Circulating tumor DNA tracking provides up to 6 months lead time over radiological RECIST 1.1 progression
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">
                    Live Stream: {isSimulating ? "Streaming" : "Paused"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  {activePatient.liquidBiopsyTrend.map((point, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        point.status === "Molecular Progression"
                          ? "bg-rose-950/50 border-rose-800"
                          : point.status === "Clearing"
                          ? "bg-emerald-950/40 border-emerald-800"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{point.date}</span>
                        <span
                          className={`font-bold ${
                            point.status === "Molecular Progression"
                              ? "text-rose-400"
                              : point.status === "Clearing"
                              ? "text-emerald-400"
                              : "text-cyan-400"
                          }`}
                        >
                          {point.status}
                        </span>
                      </div>
                      <div className="mt-2 text-xl font-bold font-mono text-white">
                        {point.ctDNAFraction}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {point.mutantCopiesPerMl} copies/mL ({point.targetGene})
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Serial ctDNA Fraction (%) vs Threshold Baseline (0.5%)
                  </h4>
                  <div className="h-40 flex items-end gap-6 pt-4 px-2">
                    {activePatient.liquidBiopsyTrend.map((point, idx) => {
                      const heightPercent = Math.min(100, Math.max(10, point.ctDNAFraction * 10));
                      const isHigh = point.ctDNAFraction >= 5.0;
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                        >
                          <span className="text-[10px] font-mono text-slate-300 font-bold">
                            {point.ctDNAFraction}%
                          </span>
                          <div
                            className={`w-full max-w-[48px] rounded-t-md transition-all duration-500 ${
                              isHigh
                                ? "bg-gradient-to-t from-rose-700 to-rose-400"
                                : "bg-gradient-to-t from-cyan-700 to-cyan-400"
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="text-[10px] font-mono text-slate-500">
                            {point.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "TRIALS" && (
            <div className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400" />
                      Genomically-Matched Interventional Clinical Trials
                    </h3>
                    <p className="text-xs text-slate-400">
                      Real-time harmonization with ClinicalTrials.gov and NCI MATCH / ASCO TAPUR registry
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {activePatient.trials.map((trial) => (
                    <div
                      key={trial.nctId}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-700 transition space-y-2"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {trial.nctId}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {trial.phase}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">AI Match Score:</span>
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {trial.matchingScore}% Match
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white">{trial.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <strong className="text-cyan-400">Biomarker Eligibility: </strong>
                        {trial.biomarkerCriteria}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                        <div>
                          <span>Locations: </span>
                          <strong className="text-slate-300">{trial.locations.join(" • ")}</strong>
                        </div>
                        <div>
                          <span>Sponsor: </span>
                          <strong className="text-slate-300">{trial.sponsor}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "DRUG_GENE" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-indigo-400" />
                  Pharmacogenomic & Targeted Resistance Interaction Matrix
                </h3>
                <p className="text-xs text-slate-400">
                  Comprehensive drug sensitivity, acquired resistance signatures, and synergistic combination therapies
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePatient.variants.map((v) => (
                  <div key={v.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 font-mono text-sm">
                        {v.gene} {v.hgvsp}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                        {v.cosmicId}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300">
                      <strong className="text-slate-400">Clinical Significance:</strong> {v.clinsig}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> High Sensitivity Targets:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {v.actionableTherapy.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[11px] border border-emerald-800"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {v.resistanceMarkers.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Resistance Signatures:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {v.resistanceMarkers.map((r, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 text-[11px] border border-rose-800"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "TUMOR_BOARD" && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Molecular Tumor Board (MTB) Decisions & Audit Records
                  </h3>
                  <p className="text-xs text-slate-400">
                    Interdisciplinary genomic consultation logs meeting CLIA/CAP and ISO 15189 accreditation standards
                  </p>
                </div>
                <button
                  onClick={() => setTumorBoardModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
                >
                  + Add Decision Entry
                </button>
              </div>

              <div className="space-y-3">
                {boardLogs
                  .filter((log) => log.patientId === activePatient.id)
                  .map((log) => (
                    <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 text-xs">
                        <div className="font-bold text-cyan-300">{log.oncologist}</div>
                        <div className="text-slate-500 font-mono">{log.timestamp}</div>
                      </div>

                      <div className="text-xs text-slate-200">
                        <strong className="text-slate-400">Intervention: </strong>
                        {log.proposedIntervention}
                      </div>

                      <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <strong className="text-cyan-400">Molecular Rationale: </strong>
                        {log.rationale}
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">Action Items:</div>
                        <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                          {log.actionItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {activeModalVariant && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Dna className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Genomic Variant Dossier: {activeModalVariant.gene} {activeModalVariant.hgvsp}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalVariant(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500">HGVS coding:</span>
                <div className="font-mono font-semibold text-slate-200 mt-0.5">
                  {activeModalVariant.hgvsc}
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500">COSMIC ID:</span>
                <div className="font-mono font-semibold text-cyan-300 mt-0.5">
                  {activeModalVariant.cosmicId}
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500">Variant Allele Freq (VAF):</span>
                <div className="font-mono font-semibold text-amber-400 mt-0.5">
                  {activeModalVariant.vaf}%
                </div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500">Read Depth:</span>
                <div className="font-mono font-semibold text-slate-200 mt-0.5">
                  {activeModalVariant.readDepth}x
                </div>
              </div>
            </div>

            <div className="text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 font-bold">Clinical Evidence Summary:</span>
              <p className="text-slate-300 leading-relaxed">{activeModalVariant.clinsig}</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModalVariant(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {tumorBoardModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Add Molecular Tumor Board Recommendation
              </h3>
              <button
                onClick={() => setTumorBoardModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Proposed Therapeutic Intervention
                </label>
                <input
                  type="text"
                  placeholder="e.g., Switch to Amivantamab + Lazertinib dual blockade"
                  value={newActionItem}
                  onChange={(e) => setNewActionItem(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Molecular Rationale & Evidence
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed genomic justification based on VAF, resistance markers, and NCCN guideline..."
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTumorBoardModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTumorBoardLog}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow"
              >
                Sign & Save to Audit Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
