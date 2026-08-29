/**
 * Pediatric ICU & Neonatal Critical Care Telemetry Data Models
 * Adheres to Phoenix Sepsis Criteria 2024, PALS (Pediatric Advanced Life Support),
 * PRISM III (Pediatric Risk of Mortality), and FDA 21 CFR Part 11 telemetry standards.
 */

export const AGE_GROUP_BRACKETS = {
  NEONATE: {
    id: 'NEONATE',
    label: 'Neonate (0 - 28 days)',
    minAgeMonths: 0,
    maxAgeMonths: 0.93,
    hrRange: [100, 180],
    rrRange: [30, 60],
    sbpRange: [60, 90],
    dbpRange: [30, 60],
    normalCapRefillSec: 2,
    hypotensionCutoff: 60,
  },
  INFANT: {
    id: 'INFANT',
    label: 'Infant (1 - 12 months)',
    minAgeMonths: 1,
    maxAgeMonths: 12,
    hrRange: [90, 160],
    rrRange: [25, 45],
    sbpRange: [70, 105],
    dbpRange: [35, 65],
    normalCapRefillSec: 2,
    hypotensionCutoff: 70,
  },
  TODDLER: {
    id: 'TODDLER',
    label: 'Toddler (1 - 3 years)',
    minAgeMonths: 13,
    maxAgeMonths: 36,
    hrRange: [80, 140],
    rrRange: [20, 35],
    sbpRange: [75, 110],
    dbpRange: [40, 70],
    normalCapRefillSec: 2,
    hypotensionCutoff: 70, // 70 + (2 * age)
  },
  PRESCHOOL: {
    id: 'PRESCHOOL',
    label: 'Preschool (4 - 5 years)',
    minAgeMonths: 37,
    maxAgeMonths: 60,
    hrRange: [75, 120],
    rrRange: [18, 30],
    sbpRange: [80, 115],
    dbpRange: [45, 75],
    normalCapRefillSec: 2,
    hypotensionCutoff: 78,
  },
  SCHOOL_AGE: {
    id: 'SCHOOL_AGE',
    label: 'School-Age (6 - 11 years)',
    minAgeMonths: 61,
    maxAgeMonths: 132,
    hrRange: [70, 110],
    rrRange: [14, 24],
    sbpRange: [85, 120],
    dbpRange: [50, 80],
    normalCapRefillSec: 2,
    hypotensionCutoff: 82,
  },
  ADOLESCENT: {
    id: 'ADOLESCENT',
    label: 'Adolescent (12 - 18 years)',
    minAgeMonths: 133,
    maxAgeMonths: 216,
    hrRange: [60, 100],
    rrRange: [12, 20],
    sbpRange: [90, 135],
    dbpRange: [55, 85],
    normalCapRefillSec: 2,
    hypotensionCutoff: 90,
  },
};

export const PEWS_ESCALATION_LEVELS = {
  LOW_RISK: {
    scoreRange: [0, 2],
    label: 'Routine PICU Monitoring',
    color: 'emerald',
    nursingFrequency: 'q4h vitals assessment',
    physicianNotification: 'Routine round notification',
  },
  MODERATE_RISK: {
    scoreRange: [3, 4],
    label: 'Elevated Decompensation Hazard',
    color: 'amber',
    nursingFrequency: 'q1h vitals + continuous pulse oximetry',
    physicianNotification: 'PICU Fellow bedside review within 30 min',
  },
  HIGH_RISK: {
    scoreRange: [5, 6],
    label: 'High Clinical Deterioration Threat',
    color: 'orange',
    nursingFrequency: 'q15m telemetry checks + airway standby',
    physicianNotification: 'Immediate Attending Intensivist bedside evaluation',
  },
  CRITICAL_RISK: {
    scoreRange: [7, 13],
    label: 'Impending Pediatric Cardiopulmonary Arrest',
    color: 'rose',
    nursingFrequency: '1-on-1 Dedicated PICU Nurse + Full Code Team Standby',
    physicianNotification: 'STAT Pediatric Rapid Response / Code Pink Trigger',
  },
};

export const PHOENIX_SEPSIS_CRITERIA = {
  CARDIOVASCULAR: {
    maxPoints: 6,
    description: 'Based on vasoactive inotrope requirements, mean arterial pressure, and lactate elevation.',
  },
  RESPIRATORY: {
    maxPoints: 3,
    description: 'Based on PaO2/FiO2 ratio, SpO2/FiO2 ratio, or invasive mechanical ventilation support.',
  },
  NEUROLOGICAL: {
    maxPoints: 2,
    description: 'Based on Glasgow Coma Scale (GCS <= 10) or bilaterally unreactive pupils.',
  },
  COAGULATION: {
    maxPoints: 2,
    description: 'Based on platelet count < 100k, INR > 1.3, or D-dimer / Fibrinogen consumption.',
  },
};

export const INITIAL_PICU_PATIENTS = [
  {
    id: 'PAT-PICU-101',
    name: 'Leo Chen',
    ageMonths: 3.5,
    ageDisplay: '3.5 months',
    gender: 'Male',
    ageGroup: 'INFANT',
    weightKg: 5.4,
    bedNumber: 'PICU-Pod-01',
    primaryDiagnosis: 'Severe RSV Bronchiolitis with Impending Respiratory Failure',
    admissionDate: '2026-08-20',
    heartRate: 172, // Tachycardia
    respiratoryRate: 58, // Tachypnea
    systolicBp: 78,
    diastolicBp: 44,
    meanArterialPressure: 55,
    spo2: 91,
    temperatureCelsius: 38.8,
    capillaryRefillSec: 3.5, // Prolonged
    behaviorScore: 2, // Irritable, consolable with effort
    cardiovascularScore: 1, // Cap refill 3-4s or mild tachycardia
    respiratoryScore: 2, // Tracheal tugging, subcostal retractions, grunting
    nebulizerBonus: true,
    persistentVomiting: false,
    pewsScore: 7, // High score
    respiratorySupportType: 'HFNC', // High Flow Nasal Cannula
    fio2Percent: 60,
    hfncFlowLpm: 12.0, // 2.2 L/kg/min
    invasiveVentilator: {
      mode: 'OFF',
      pip: 0,
      peep: 0,
      tidalVolumeMl: 0,
      meanAirwayPressure: 0,
    },
    pao2: 68,
    paco2: 56, // Hypercapnia
    arterialPh: 7.26,
    lactate: 2.8,
    visScore: 0,
    sedationRass: -1,
    urineOutputLastHourMl: 7.2, // 1.33 mL/kg/h
    fluidBalance24hMl: 140,
    activeAlerts: [
      { id: 'ALT-101-1', severity: 'CRITICAL', message: 'PEWS Score 7: Impending Respiratory Exhaustion - Intubation Equipment Primed at Bedside', timestamp: '5 min ago' },
      { id: 'ALT-101-2', severity: 'HIGH', message: 'Severe Respiratory Acidosis (pH 7.26, PaCO2 56 mmHg) under HFNC 12 L/min', timestamp: '20 min ago' }
    ]
  },
  {
    id: 'PAT-PICU-102',
    name: 'Maya Rodriguez',
    ageMonths: 0.45, // 14 days
    ageDisplay: '14 days (Neonate)',
    gender: 'Female',
    ageGroup: 'NEONATE',
    weightKg: 3.2,
    bedNumber: 'NICU-Isolette-04',
    primaryDiagnosis: 'Hypoplastic Left Heart Syndrome (HLHS) post-Stage 1 Norwood Reconstruction',
    admissionDate: '2026-08-19',
    heartRate: 154,
    respiratoryRate: 38,
    systolicBp: 64,
    diastolicBp: 36,
    meanArterialPressure: 45,
    spo2: 81, // Target single-ventricle 75-85%
    temperatureCelsius: 36.9,
    capillaryRefillSec: 2.5,
    behaviorScore: 1,
    cardiovascularScore: 2, // High inotrope dependency
    respiratoryScore: 1,
    nebulizerBonus: false,
    persistentVomiting: false,
    pewsScore: 4,
    respiratorySupportType: 'MECHANICAL_VENTILATION',
    fio2Percent: 35,
    hfncFlowLpm: 0,
    invasiveVentilator: {
      mode: 'PRVC',
      pip: 18,
      peep: 5,
      tidalVolumeMl: 20, // 6.2 mL/kg
      meanAirwayPressure: 9.5,
    },
    pao2: 44,
    paco2: 40,
    arterialPh: 7.38,
    lactate: 3.1,
    visScore: 17.5, // High Vasoactive-Inotrope Score
    sedationRass: -3,
    urineOutputLastHourMl: 4.8, // 1.5 mL/kg/h
    fluidBalance24hMl: 65,
    activeAlerts: [
      { id: 'ALT-102-1', severity: 'HIGH', message: 'Single Ventricle Qp:Qs Balance Monitoring (SpO2 Target 75-85% Active)', timestamp: '15 min ago' },
      { id: 'ALT-102-2', severity: 'MEDIUM', message: 'Milrinone (0.5 mcg/kg/min) + Epinephrine (0.05 mcg/kg/min) infusion active', timestamp: '1 hour ago' }
    ]
  },
  {
    id: 'PAT-PICU-103',
    name: 'Noah Gallagher',
    ageMonths: 48, // 4 years
    ageDisplay: '4.0 years',
    gender: 'Male',
    ageGroup: 'PRESCHOOL',
    weightKg: 16.5,
    bedNumber: 'PICU-Pod-03',
    primaryDiagnosis: 'Meningococcal Septic Shock with Refractory Vasodilatory Hypotension',
    admissionDate: '2026-08-21',
    heartRate: 168,
    respiratoryRate: 34,
    systolicBp: 72, // Below cutoff (78 mmHg)
    diastolicBp: 38,
    meanArterialPressure: 49,
    spo2: 95,
    temperatureCelsius: 39.4,
    capillaryRefillSec: 4.5, // Severe flash/cold shock
    behaviorScore: 3, // Lethargic / non-responsive to voice
    cardiovascularScore: 3, // Severe shock, hypotension
    respiratoryScore: 1,
    nebulizerBonus: false,
    persistentVomiting: true,
    pewsScore: 9, // Critical
    respiratorySupportType: 'MECHANICAL_VENTILATION',
    fio2Percent: 50,
    hfncFlowLpm: 0,
    invasiveVentilator: {
      mode: 'SIMV-PC',
      pip: 22,
      peep: 8,
      tidalVolumeMl: 110,
      meanAirwayPressure: 13.0,
    },
    pao2: 88,
    paco2: 35,
    arterialPh: 7.18, // Severe metabolic lactic acidosis
    lactate: 6.8,
    visScore: 32.0, // Critical inotrope score
    sedationRass: -4,
    urineOutputLastHourMl: 6.0, // 0.36 mL/kg/h (Oliguria)
    fluidBalance24hMl: 1450,
    activeAlerts: [
      { id: 'ALT-103-1', severity: 'CRITICAL', message: 'PHOENIX SEPSIS ALERT: Fluid-Refractory Septic Shock (Lactate 6.8 mmol/L, VIS 32.0)', timestamp: '2 min ago' },
      { id: 'ALT-103-2', severity: 'CRITICAL', message: 'Severe Hypotension (MAP 49 mmHg) - Norepinephrine up-titration indicated', timestamp: '12 min ago' }
    ]
  },
  {
    id: 'PAT-PICU-104',
    name: 'Sophia Patel',
    ageMonths: 96, // 8 years
    ageDisplay: '8.0 years',
    gender: 'Female',
    ageGroup: 'SCHOOL_AGE',
    weightKg: 28.0,
    bedNumber: 'PICU-Pod-05',
    primaryDiagnosis: 'Refractory Status Epilepticus post-Burst Suppression Protocol',
    admissionDate: '2026-08-20',
    heartRate: 88,
    respiratoryRate: 16,
    systolicBp: 104,
    diastolicBp: 62,
    meanArterialPressure: 76,
    spo2: 99,
    temperatureCelsius: 37.1,
    capillaryRefillSec: 1.5,
    behaviorScore: 0, // Pharmacologically paralyzed/sedated
    cardiovascularScore: 0,
    respiratoryScore: 0,
    nebulizerBonus: false,
    persistentVomiting: false,
    pewsScore: 1,
    respiratorySupportType: 'MECHANICAL_VENTILATION',
    fio2Percent: 30,
    hfncFlowLpm: 0,
    invasiveVentilator: {
      mode: 'PRVC',
      pip: 16,
      peep: 5,
      tidalVolumeMl: 195,
      meanAirwayPressure: 8.5,
    },
    pao2: 120,
    paco2: 38,
    arterialPh: 7.41,
    lactate: 1.2,
    visScore: 0,
    sedationRass: -5,
    urineOutputLastHourMl: 42.0, // 1.5 mL/kg/h
    fluidBalance24hMl: 320,
    activeAlerts: [
      { id: 'ALT-104-1', severity: 'LOW', message: 'Continuous cEEG monitoring active: 90% Burst Suppression maintained', timestamp: '45 min ago' }
    ]
  }
];
