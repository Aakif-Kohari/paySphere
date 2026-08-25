/**
 * Acute Coronary Syndrome (ACS) & STEMI Interventional Cath Lab Models.
 *
 * Implements ACC/AHA 2026 Guidelines for STEMI Management, European Society of Cardiology
 * (ESC) 0/1-hour High-Sensitivity Troponin Algorithms, Killip Classification for Heart Failure,
 * TIMI Risk Score for STEMI, GRACE 2.0 ACS Risk Registry, and Door-to-Balloon (D2B) Quality Metrics.
 */

export const STEMI_SEVERITY_LEVELS = Object.freeze({
  ACUTE_STEMI: {
    id: 'ACUTE_STEMI',
    label: 'Acute ST-Elevation Myocardial Infarction (STEMI)',
    color: 'rose',
    priority: 1,
    description: 'Transmural myocardial ischemia requiring emergent reperfusion therapy within 90 minutes.',
  },
  NSTEMI_VERY_HIGH_RISK: {
    id: 'NSTEMI_VERY_HIGH_RISK',
    label: 'Non-ST-Elevation ACS (Very High Risk)',
    color: 'orange',
    priority: 1,
    description: 'Hemodynamic instability, cardiogenic shock, recurrent angina, or life-threatening arrhythmias requiring immediate angiography (< 2h).',
  },
  CARDIOGENIC_SHOCK: {
    id: 'CARDIOGENIC_SHOCK',
    label: 'Post-Infarction Cardiogenic Shock',
    color: 'purple',
    priority: 1,
    description: 'Hypotension (SBP < 90 mmHg or MAP < 65 mmHg) with hypoperfusion (CPO < 0.6 W, Lactate > 2.0) requiring mechanical circulatory support.',
  },
  UNSTABLE_ANGINA: {
    id: 'UNSTABLE_ANGINA',
    label: 'High-Risk Unstable Angina',
    color: 'amber',
    priority: 2,
    description: 'Rest angina with dynamic ST changes or elevated biomarker trajectory.',
  },
});

export const D2B_MILESTONES = Object.freeze({
  DOOR_TO_ECG: {
    id: 'DOOR_TO_ECG',
    title: '1. 12-Lead ECG Acquisition & Interpretation',
    targetMinutes: 10,
    rationale: 'Perform and interpret initial 12-lead ECG within 10 minutes of emergency arrival.',
    guidelineRef: 'ACC/AHA Class I (Level of Evidence B)',
  },
  CATH_LAB_ACTIVATION: {
    id: 'CATH_LAB_ACTIVATION',
    title: '2. Code STEMI Cath Lab Team Pager Activation',
    targetMinutes: 20,
    rationale: 'Simultaneous notification of interventional cardiologist, fellows, nurses, and cath tech team.',
    guidelineRef: 'ACC/AHA STEMI System Performance Standard',
  },
  PATIENT_ARRIVAL_LAB: {
    id: 'PATIENT_ARRIVAL_LAB',
    title: '3. Patient Transport & Cath Lab Table Arrival',
    targetMinutes: 45,
    rationale: 'Direct transfer to interventional suite bypassing inpatient holding areas.',
    guidelineRef: 'ACC/AHA Reperfusion Logistics Guideline',
  },
  ARTERIAL_ACCESS: {
    id: 'ARTERIAL_ACCESS',
    title: '4. Vascular Access (Radial First / Femoral Secondary)',
    targetMinutes: 60,
    rationale: 'Radial artery ultrasound-guided puncture to reduce major bleeding and vascular complications.',
    guidelineRef: 'ESC Guidelines for Radial-First Approach',
  },
  BALLOON_TIME: {
    id: 'BALLOON_TIME',
    title: '5. Guidewire Crossing & First Device / Balloon Inflation',
    targetMinutes: 90,
    rationale: 'Definitive restoration of TIMI 3 antegrade coronary blood flow (D2B <= 90 minutes).',
    guidelineRef: 'ACC/AHA / NCDR CathPCI Benchmark',
  },
  POST_PCI_ANTICOAGULATION: {
    id: 'POST_PCI_ANTICOAGULATION',
    title: '6. Heparin ACT Target Monitoring & DAPT Loading',
    targetMinutes: 120,
    rationale: 'Maintain Activated Clotting Time (ACT) 250-300 seconds during PCI; ensure DAPT loading.',
    guidelineRef: 'ACC/AHA Antithrombotic Guidelines',
  },
});

export const KILLIP_CLASSIFICATION = Object.freeze({
  CLASS_I: {
    stage: 'Killip I',
    criteria: 'No clinical signs of heart failure or cardiac decompensation.',
    hospitalMortality: '5 - 6%',
    color: 'emerald',
  },
  CLASS_II: {
    stage: 'Killip II',
    criteria: 'Mild-to-moderate heart failure: Rales in lower lung fields (< 50%), S3 gallop, elevated JVP.',
    hospitalMortality: '17%',
    color: 'amber',
  },
  CLASS_III: {
    stage: 'Killip III',
    criteria: 'Severe heart failure / Frank Pulmonary Edema (rales > 50% of lung fields).',
    hospitalMortality: '38%',
    color: 'orange',
  },
  CLASS_IV: {
    stage: 'Killip IV',
    criteria: 'Cardiogenic Shock: SBP < 90 mmHg, oliguria, cyanosis, cold extremities, CPO < 0.6 W.',
    hospitalMortality: '67 - 80%',
    color: 'rose',
  },
});

export const TIMI_STEMI_RISK_FACTORS = Object.freeze([
  { id: 'AGE_75_PLUS', label: 'Age >= 75 years', points: 3 },
  { id: 'AGE_65_74', label: 'Age 65 - 74 years', points: 2 },
  { id: 'DIABETES_HTN_ANGINA', label: 'History of Diabetes, Hypertension, or Angina', points: 1 },
  { id: 'SBP_UNDER_100', label: 'Systolic Blood Pressure < 100 mmHg', points: 3 },
  { id: 'HR_OVER_100', label: 'Heart Rate > 100 BPM', points: 2 },
  { id: 'KILLIP_II_IV', label: 'Killip Class II - IV Presentation', points: 2 },
  { id: 'WEIGHT_UNDER_67', label: 'Body Weight < 67 kg (150 lbs)', points: 1 },
  { id: 'ANTERIOR_ST_LBBB', label: 'Anterior ST-Elevation or New LBBB', points: 1 },
  { id: 'TIME_TO_RX_OVER_4H', label: 'Time to Reperfusion > 4 hours', points: 1 },
]);

export const CARDIOLOGY_PATIENT_FIXTURES = Object.freeze([
  {
    id: 'STEMI-PAT-701',
    mrn: 'CAR-109482',
    name: 'Robert Hastings',
    ageYears: 63,
    sex: 'Male',
    location: 'Cardiac Cath Lab - Suite 01',
    primaryDiagnosis: 'Acute Anterior STEMI (Culprit LAD Occlusion)',
    ecgLeadChanges: '4mm ST-Elevation in V1-V4 with reciprocal ST depression in II, III, aVF',
    severity: 'ACUTE_STEMI',
    killipClass: 'CLASS_II',
    timiScore: 6,
    graceScore: 168,
    weightKg: 78,
    heartRate: 112,
    systolicBp: 96,
    diastolicBp: 58,
    map: 70.7,
    cardiacOutput: 3.8, // L/min
    cardiacIndex: 2.1,  // L/min/m2
    cardiacPowerOutput: 0.59, // W
    coronaryPerfusionPressure: 44, // mmHg
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
    culpritVessel: 'Left Anterior Descending (LAD) - Proximal 100% Thrombotic Occlusion (TIMI 0 Flow)',
    d2bTimerMinutes: 38,
    d2bProgress: {
      doorToEcgDone: true,
      cathLabActivationDone: true,
      patientArrivalLabDone: true,
      arterialAccessDone: true,
      balloonTimeDone: false,
      postPciAnticoagulationDone: false,
    },
  },
  {
    id: 'STEMI-PAT-702',
    mrn: 'CAR-882319',
    name: 'Eleanor Vance',
    ageYears: 74,
    sex: 'Female',
    location: 'CCU - Bed 02 (Cardiogenic Shock Holding)',
    primaryDiagnosis: 'Acute Inferoposterior STEMI with RV Infarction & Cardiogenic Shock',
    ecgLeadChanges: 'ST-Elevation in II, III, aVF, V4R (1.5mm) with Complete AV Heart Block',
    severity: 'CARDIOGENIC_SHOCK',
    killipClass: 'CLASS_IV',
    timiScore: 9,
    graceScore: 215,
    weightKg: 64,
    heartRate: 46, // Bradycardic due to 3rd degree AV block
    systolicBp: 82,
    diastolicBp: 44,
    map: 56.6,
    cardiacOutput: 2.4, // L/min
    cardiacIndex: 1.4,  // L/min/m2
    cardiacPowerOutput: 0.30, // W (Severe cardiogenic shock)
    coronaryPerfusionPressure: 32, // mmHg
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
      actTarget: '300 - 350 seconds (Bivalirudin)',
    },
    culpritVessel: 'Right Coronary Artery (RCA) - Proximal Acute Ectatic Thrombus',
    d2bTimerMinutes: 52,
    d2bProgress: {
      doorToEcgDone: true,
      cathLabActivationDone: true,
      patientArrivalLabDone: true,
      arterialAccessDone: true,
      balloonTimeDone: false,
      postPciAnticoagulationDone: true,
    },
  },
  {
    id: 'STEMI-PAT-703',
    mrn: 'CAR-554109',
    name: 'David Kincaid',
    ageYears: 58,
    sex: 'Male',
    location: 'Emergency Department - Resus 03',
    primaryDiagnosis: 'Very High-Risk NSTEMI with Refractory Rest Angina',
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
    culpritVessel: 'Left Circumflex (LCx) / Obtuse Marginal 1 Subtotal 99% Stenosis',
    d2bTimerMinutes: 22,
    d2bProgress: {
      doorToEcgDone: true,
      cathLabActivationDone: true,
      patientArrivalLabDone: false,
      arterialAccessDone: false,
      balloonTimeDone: false,
      postPciAnticoagulationDone: false,
    },
  },
]);
