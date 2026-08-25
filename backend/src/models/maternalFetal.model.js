/**
 * Maternal-Fetal Telemetry, Labor & Delivery, High-Risk Obstetrics Data Models
 * Adheres to ACOG (American College of Obstetricians and Gynecologists) Guidelines,
 * NICHD 3-Tier Fetal Heart Rate (FHR) Interpretation System,
 * AIM (Alliance for Innovation on Maternal Health) Obstetric Hemorrhage & Hypertension Bundles,
 * and FDA 21 CFR Part 11 Electronic Telemetry & Audit Integrity Standards.
 */

export const NICHD_FHR_CATEGORIES = {
  CATEGORY_I_NORMAL: {
    id: "CATEGORY_I",
    name: "Category I: Strongly Predictive of Normal Fetal Acid-Base Status",
    criteria: [
      "Baseline FHR: 110 - 160 BPM",
      "Baseline FHR Variability: Moderate (6 - 25 BPM amplitude)",
      "Late or Variable Decelerations: Absent",
      "Early Decelerations: Present or Absent",
      "Accelerations: Present or Absent",
    ],
    clinicalManagement: "Standard continuous/intermittent intrapartum surveillance; no specific intervention required.",
  },
  CATEGORY_II_INDETERMINATE: {
    id: "CATEGORY_II",
    name: "Category II: Indeterminate (Requires Close Evaluation and Surveillance)",
    criteria: [
      "Minimal baseline variability or Marked variability (> 25 BPM)",
      "Tachycardia (> 160 BPM) or Bradycardia without absent variability (100 - 110 BPM)",
      "Recurrent variable decelerations with minimal/moderate variability",
      "Prolonged deceleration >= 2 min but < 10 min",
      "Recurrent late decelerations with moderate variability",
    ],
    clinicalManagement: "Intrauterine Resuscitation: Maternal repositioning (Left lateral), IV fluid bolus, Oxygen (10 L/min via non-rebreather), Discontinue Oxytocin infusion.",
  },
  CATEGORY_III_ABNORMAL: {
    id: "CATEGORY_III",
    name: "Category III: Predictive of Abnormal Fetal Acid-Base Status / Severe Acidemia",
    criteria: [
      "Absent baseline FHR variability AND any of the following: Recurrent Late Decelerations, Recurrent Variable Decelerations, Bradycardia (< 110 BPM)",
      "Sinusoidal Pattern (Smooth, undulating wave pattern of regular frequency 3-5 cycles/min for >= 20 min indicating severe fetal anemia/hypoxia)",
    ],
    clinicalManagement: "STAT Obstetric Emergency: Immediate preparation for Crash Cesarean Delivery unless spontaneous vaginal delivery is imminent within 15 minutes.",
  },
};

export const AIM_PPH_STAGES = {
  STAGE_1: {
    stage: "Stage 1: Blood Loss > 500 mL (Vaginal) or > 1000 mL (Cesarean)",
    vitalSigns: "Normal HR & BP; brisk bleeding",
    actions: [
      "Quantify blood loss (QBL) accurately via gravimetric / graduated drape measurement.",
      "Fundal massage; verify bladder emptying via Foley catheter.",
      "Oxytocin infusion: 20-40 units in 1000 mL crystalloid @ 500 mL/hr.",
      "Methergine (Methylergonovine) 0.2 mg IM (Contraindicated in hypertension).",
      "Type & Screen, complete blood count, and coagulation panel.",
    ],
  },
  STAGE_2: {
    stage: "Stage 2: Continued Bleeding / QBL 1000 - 1500 mL",
    vitalSigns: "Mild tachycardia / borderline hypotension",
    actions: [
      "Mobilize Obstetric Rapid Response Team and second Attending Obstetrician.",
      "Carboprost Tromethamine (Hemabate) 250 mcg IM (Contraindicated in asthma).",
      "Misoprostol 800 - 1000 mcg PR or sublingual.",
      "Tranexamic Acid (TXA) 1g IV over 10 minutes within 3 hours of delivery.",
      "Prepare 2 units PRBC crossmatched; transfer to Operating Room.",
    ],
  },
  STAGE_3: {
    stage: "Stage 3: QBL > 1500 mL OR Transfusion of >= 2 units PRBC OR Vital Sign Instability",
    vitalSigns: "HR > 120, SBP < 85, Shock Index > 0.9",
    actions: [
      "Activate Code Obstetric Hemorrhage / Massive Transfusion Protocol (MTP).",
      "Surgical intervention: Intrauterine balloon tamponade (Bakri balloon), B-Lynch uterine compression suture, uterine artery ligation.",
      "Emergency Peripartum Hysterectomy if bleeding uncontrolled.",
    ],
  },
};

export const MAGNESIUM_SULFATE_PROTOCOLS = {
  INDICATION: "Severe Preeclampsia & Eclampsia Seizure Prophylaxis / Fetal Neuroprotection (< 32 weeks)",
  DOSING: {
    loadingDoseGrams: 4.0, // 4-6g IV over 15-20 min
    maintenanceRateGramsHour: 2.0, // 1-2g/hr IV infusion
    therapeuticSerumRangeMgDl: [4.8, 8.4], // 2.0 - 3.5 mmol/L (4.8 - 8.4 mg/dL)
  },
  TOXICITY_THRESHOLDS: {
    lossOfPatellarReflexes: 9.6, // mg/dL
    respiratoryDepression: 12.0, // mg/dL (RR < 12)
    cardiacArrest: 18.0, // mg/dL
    reversalAntidote: "Calcium Gluconate 10% (1g / 10 mL IV over 3-5 min)",
  },
};

export const INITIAL_OBSTETRIC_PATIENTS = [
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
    montevideoUnits: 247, // Adequate active labor (200-250 MVU)
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
    fhrBaselineBpm: 95, // Bradycardia + absent variability
    fhrVariability: "ABSENT",
    fhrAccelerationsPresent: false,
    fhrDecelerationType: "RECURRENT_LATE_DECELERATIONS",
    nichdCategory: "CATEGORY_III",
    tocoContractionFrequencyPer10Min: 6.0, // Uterine tachysystole
    tocoContractionIntensityMmHg: 70,
    montevideoUnits: 420, // Excessive hyperstimulation
    maternalHeartRateBpm: 128,
    maternalSystolicBpMmHg: 84,
    maternalDiastolicBpMmHg: 48,
    maternalMapMmHg: 60.0,
    maternalSpO2Percent: 94.0,
    maternalTempC: 38.3, // Intra-amniotic infection / chorioamnionitis
    preeclampsiaStatus: "CHORIOAMNIONITIS_TACHYSYSTOLE",
    magnesiumSulfateInfusionGramsHour: 0.0,
    serumMagnesiumMgDl: 1.9,
    patellarReflexes: "1+_DIMINISHED",
    urineOutputLastHourMl: 20,
    quantitativeBloodLossMl: 1650,
    aimPphStage: "STAGE_3_SEVERE_HEMORRHAGE",
    oxytocinInfusionMunitsMin: 0,
    fetalScalpPh: 7.08, // Severe fetal acidemia
    fetalScalpLactateMmol: 7.8,
    clinicalStatus: "CRITICAL_CATEGORY_III_STAT_CESAREAN_PPH_STAGE_3",
  },
];
