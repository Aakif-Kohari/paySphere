/**
 * Nephrology CRRT & Renal Replacement Therapy Data Models
 * Adheres to KDIGO (Kidney Disease: Improving Global Outcomes) 2012 / 2024 guidelines,
 * Acute Dialysis Quality Initiative (ADQI), and FDA 21 CFR Part 11 medical telemetry standards.
 */

export const KDIGO_STAGES = {
  STAGE_0: {
    stage: 0,
    label: 'No AKI / Baseline Renal Function',
    creatinineCriteria: 'Baseline or < 1.5x baseline',
    urineOutputCriteria: '> 0.5 mL/kg/h for 6 hours',
    color: 'emerald',
    riskLevel: 'LOW',
  },
  STAGE_1: {
    stage: 1,
    label: 'KDIGO Stage 1 AKI',
    creatinineCriteria: '1.5-1.9x baseline OR >= 0.3 mg/dL increase',
    urineOutputCriteria: '< 0.5 mL/kg/h for 6-12 hours',
    color: 'amber',
    riskLevel: 'MODERATE',
  },
  STAGE_2: {
    stage: 2,
    label: 'KDIGO Stage 2 AKI',
    creatinineCriteria: '2.0-2.9x baseline',
    urineOutputCriteria: '< 0.5 mL/kg/h for >= 12 hours',
    color: 'orange',
    riskLevel: 'HIGH',
  },
  STAGE_3: {
    stage: 3,
    label: 'KDIGO Stage 3 AKI',
    creatinineCriteria: '>= 3.0x baseline OR >= 4.0 mg/dL OR initiation of RRT',
    urineOutputCriteria: '< 0.3 mL/kg/h for >= 24h OR Anuria for >= 12h',
    color: 'rose',
    riskLevel: 'CRITICAL',
  },
};

export const CRRT_MODALITIES = {
  CVVH: {
    id: 'CVVH',
    name: 'Continuous Veno-Venous Hemofiltration',
    mechanism: 'Convection',
    clearanceType: 'Middle and Large Molecular Weight Solutes',
    description: 'High ultrafiltration rate with pre/post-filter replacement fluid substitution.',
    typicalDoseRange: '20 - 35 mL/kg/h',
    sievingCoefficientTarget: 0.95,
  },
  CVVHD: {
    id: 'CVVHD',
    name: 'Continuous Veno-Venous Hemodialysis',
    mechanism: 'Diffusion',
    clearanceType: 'Small Solute Molecules (Urea, Creatinine, K+)',
    description: 'Countercurrent dialysate flow across semipermeable biocompatible membrane.',
    typicalDoseRange: '20 - 30 mL/kg/h',
    sievingCoefficientTarget: 0.85,
  },
  CVVHDF: {
    id: 'CVVHDF',
    name: 'Continuous Veno-Venous Hemodiafiltration',
    mechanism: 'Combined Diffusion + Convection',
    clearanceType: 'Broad-Spectrum Small, Middle, and Protein-Bound Solutes',
    description: 'Simultaneous dialysate counter-flow and convective fluid replacement.',
    typicalDoseRange: '25 - 40 mL/kg/h',
    sievingCoefficientTarget: 0.98,
  },
  SCUF: {
    id: 'SCUF',
    name: 'Slow Continuous Ultrafiltration',
    mechanism: 'Pure Convection without Solute Replacement',
    clearanceType: 'Isotonic Fluid Removal Only',
    description: 'Targeted volume de-escalation for refractory fluid overload without uremic clearance.',
    typicalDoseRange: '100 - 400 mL/h net ultrafiltration',
    sievingCoefficientTarget: 1.0,
  },
};

export const ANTICOAGULATION_PROTOCOLS = {
  RCA_CITRATE: {
    id: 'RCA_CITRATE',
    name: 'Regional Citrate Anticoagulation (RCA)',
    targetPostFilterIonizedCalcium: '0.25 - 0.35 mmol/L',
    targetSystemicIonizedCalcium: '1.10 - 1.30 mmol/L',
    antidote: 'Calcium Gluconate / Calcium Chloride 10% Continuous Infusion',
    citrateLockRatioAlert: 2.5, // Total Ca to Ionized Ca ratio > 2.5 indicates citrate accumulation
    advantages: 'Minimal systemic bleeding risk, extended hemofilter lifespan (>72h).',
  },
  SYSTEMIC_HEPARIN: {
    id: 'SYSTEMIC_HEPARIN',
    name: 'Unfractionated Heparin (UFH)',
    targetAntiXa: '0.25 - 0.40 IU/mL',
    targetAPTT: '45 - 65 seconds',
    antidote: 'Protamine Sulfate (1 mg per 100 units heparin)',
    advantages: 'Familiar dosing, easy monitoring, rapid reversal.',
  },
  ARGATROBAN: {
    id: 'ARGATROBAN',
    name: 'Direct Thrombin Inhibitor (Argatroban)',
    targetAPTT: '50 - 70 seconds',
    indication: 'Heparin-Induced Thrombocytopenia (HIT Type II) in ICU renal failure.',
    antidote: 'Discontinuation (short half-life 45 min) / Recombinant factor VIIa fallback.',
    advantages: 'Hepatic metabolism, safe in severe anuric renal failure.',
  },
  PROSTACYCLIN: {
    id: 'PROSTACYCLIN',
    name: 'Prostacyclin (Epoprostenol / PGI2)',
    targetDose: '4 - 8 ng/kg/min pre-filter',
    indication: 'High bleeding risk + severe citrate intolerance/liver failure.',
    antidote: 'Immediate cessation (half-life 3-5 min).',
    advantages: 'No systemic anticoagulation, local platelet anti-aggregant.',
  },
  NONE_SALINE_FLUSH: {
    id: 'NONE_SALINE_FLUSH',
    name: 'No Anticoagulation (Periodic Saline Flush Protocol)',
    targetFlushVolume: '100 - 150 mL 0.9% NaCl every 30-60 min',
    indication: 'Active hemorrhagic shock, severe coagulopathy (INR > 2.5, Plt < 30k).',
    antidote: 'N/A',
    advantages: 'Zero pharmacologic bleeding risk.',
  },
};

export const CRRT_SAFETY_THRESHOLDS = {
  TMP_MAX_WARNING: 200, // mmHg
  TMP_MAX_CRITICAL: 250, // mmHg
  PRESSURE_DROP_WARNING: 150, // mmHg (dP = Ppre - Ppost)
  PRESSURE_DROP_CRITICAL: 200, // mmHg
  FILTRATION_FRACTION_MAX: 25, // % (FF > 25% accelerates hemoconcentration and circuit clotting)
  TOTAL_CA_TO_IONIZED_CA_RATIO_ALERT: 2.5, // Ratio > 2.5 suggests citrate toxicity
  BLOOD_FLOW_MIN: 100, // mL/min
  BLOOD_FLOW_MAX: 350, // mL/min
  POTASSIUM_MIN_SAFETY: 3.5, // mmol/L
  POTASSIUM_MAX_SAFETY: 5.5, // mmol/L
  URINE_OUTPUT_OLIGURIA: 0.5, // mL/kg/h
  URINE_OUTPUT_ANURIA: 0.1, // mL/kg/h
};

export const INITIAL_NEPHROLOGY_PATIENTS = [
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
    bun: 84, // mg/dL
    potassium: 6.2, // mmol/L
    sodium: 136, // mmol/L
    bicarbonate: 14, // mmol/L
    chloride: 104, // mmol/L
    serumOsmolality: 318, // mOsm/kg
    arterialPh: 7.21,
    arterialPco2: 28, // mmHg
    lactate: 4.2, // mmol/L
    urineOutputLastHour: 8, // mL/h (0.11 mL/kg/h -> Anuria/Severe Oliguria)
    fluidBalance24h: 3850, // mL positive
    fluidOverloadPercent: 12.4, // % (> 10% fluid overload criteria met)
    kdigoStage: 3,
    rrtIndication: 'Severe Refractory Hyperkalemia (6.2) + High Fluid Overload (12.4%) + Metabolic Acidosis (pH 7.21)',
    currentModality: 'CVVHDF',
    bloodFlowRate: 200, // mL/min (Qb)
    dialysateFlowRate: 1400, // mL/h (Qd)
    preReplacementRate: 800, // mL/h
    postReplacementRate: 400, // mL/h
    netUltrafiltrationRate: 250, // mL/h (Targeting 6000 mL net removal in 24h)
    accessPressure: -85, // mmHg
    filterPressure: 165, // mmHg
    venousPressure: 92, // mmHg
    effluentPressure: -20, // mmHg
    transmembranePressure: 142, // mmHg
    filterPressureDrop: 73, // mmHg
    filtrationFraction: 18.2, // %
    anticoagulationMode: 'RCA_CITRATE',
    citrateInfusionRate: 220, // mL/h (ACD-A)
    calciumChlorideRate: 45, // mL/h
    systemicIonizedCalcium: 1.18, // mmol/L
    postFilterIonizedCalcium: 0.31, // mmol/L
    totalSerumCalcium: 8.9, // mg/dL (2.22 mmol/L)
    totToIonizedCaRatio: 1.88, // Normal (< 2.5)
    filterRunHours: 34.5,
    filterEstimatedRemainingHours: 37.5,
    clottingRiskScore: 18, // %
    activeAlerts: [
      { id: 'ALT-401-1', severity: 'HIGH', message: 'Serum Potassium 6.2 mmol/L (Hyperkalemia) - Dialysate K+ set to 2.0 K+ Bath', timestamp: '10 min ago' },
      { id: 'ALT-401-2', severity: 'MEDIUM', message: 'Target Net UF 250 mL/h active for fluid de-escalation', timestamp: '1 hour ago' }
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
    urineOutputLastHour: 15, // mL/h (0.17 mL/kg/h)
    fluidBalance24h: 5200,
    fluidOverloadPercent: 16.8, // Massive fluid overload
    kdigoStage: 3,
    rrtIndication: 'Refractory Diuretic-Resistant Fluid Overload (16.8%) with Hemodynamic Instability',
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
    transmembranePressure: 210, // Elevating TMP
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
    clottingRiskScore: 68, // Warning elevated clotting risk
    activeAlerts: [
      { id: 'ALT-402-1', severity: 'CRITICAL', message: 'Elevated TMP (210 mmHg) - Hemofilter Fiber Clogging Detected. Consider Circuit Exchange in < 6h', timestamp: '5 min ago' },
      { id: 'ALT-402-2', severity: 'HIGH', message: 'Massive Fluid Overload (+16.8%) - Continuous Ultrafiltration monitored with Bioimpedance', timestamp: '2 hours ago' }
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
    urineOutputLastHour: 22, // mL/h
    fluidBalance24h: 2100,
    fluidOverloadPercent: 6.2,
    kdigoStage: 2,
    rrtIndication: 'High Cut-Off Convective Clearance for Plasma Myoglobin (>45,000 ng/mL) & Acidosis',
    currentModality: 'CVVH',
    bloodFlowRate: 220,
    dialysateFlowRate: 0,
    preReplacementRate: 2200, // High convective dose for myoglobin clearance
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
      { id: 'ALT-403-1', severity: 'LOW', message: 'Convective dose 41 mL/kg/h active for high-flux myoglobin extraction', timestamp: '3 hours ago' }
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
    lactate: 5.8, // Severe hyperlactatemia -> High Citrate Toxicity Risk
    urineOutputLastHour: 18,
    fluidBalance24h: 1800,
    fluidOverloadPercent: 7.5,
    kdigoStage: 2,
    rrtIndication: 'HRS-AKI with Hyperammonemia & Severe Encephalopathy; Impaired Citrate Metabolism',
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
    filtrationFraction: 0.0, // Diffusion only
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
      { id: 'ALT-404-1', severity: 'HIGH', message: 'Severe Hepatic Impairment - Citrate Anticoagulation CONTRAINDICATED. Operating on Epoprostenol infusion.', timestamp: '30 min ago' }
    ]
  }
];
