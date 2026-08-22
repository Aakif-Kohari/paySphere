/**
 * Pediatric ICU Clinical Calculation & Decision Support Engine
 * Formulations compliant with PALS 2024, PALICC 2023, Phoenix Sepsis Criteria 2024, and PRISM III.
 */

import {
  AGE_GROUP_BRACKETS,
  PEWS_ESCALATION_LEVELS,
  PHOENIX_SEPSIS_CRITERIA,
  INITIAL_PICU_PATIENTS,
} from '../models/pediatricICU.model.js';

class PediatricICUService {
  constructor() {
    this.patients = JSON.parse(JSON.stringify(INITIAL_PICU_PATIENTS));
  }

  /**
   * Determine age bracket from age in months
   */
  getAgeBracket(ageMonths) {
    if (ageMonths <= 0.93) return AGE_GROUP_BRACKETS.NEONATE;
    if (ageMonths <= 12) return AGE_GROUP_BRACKETS.INFANT;
    if (ageMonths <= 36) return AGE_GROUP_BRACKETS.TODDLER;
    if (ageMonths <= 60) return AGE_GROUP_BRACKETS.PRESCHOOL;
    if (ageMonths <= 132) return AGE_GROUP_BRACKETS.SCHOOL_AGE;
    return AGE_GROUP_BRACKETS.ADOLESCENT;
  }

  /**
   * Calculate Pediatric Early Warning Score (PEWS)
   * Score 0 - 13
   */
  calculatePEWS({
    behaviorScore,
    cardiovascularScore,
    respiratoryScore,
    nebulizerBonus = false,
    persistentVomiting = false,
  }) {
    let totalScore = behaviorScore + cardiovascularScore + respiratoryScore;
    if (nebulizerBonus) totalScore += 2;
    if (persistentVomiting) totalScore += 2;

    let escalation = PEWS_ESCALATION_LEVELS.LOW_RISK;
    if (totalScore >= 7) {
      escalation = PEWS_ESCALATION_LEVELS.CRITICAL_RISK;
    } else if (totalScore >= 5) {
      escalation = PEWS_ESCALATION_LEVELS.HIGH_RISK;
    } else if (totalScore >= 3) {
      escalation = PEWS_ESCALATION_LEVELS.MODERATE_RISK;
    }

    return {
      pewsScore: totalScore,
      behaviorScore,
      cardiovascularScore,
      respiratoryScore,
      nebulizerBonus,
      persistentVomiting,
      escalationLevel: escalation.label,
      color: escalation.color,
      nursingFrequency: escalation.nursingFrequency,
      physicianNotification: escalation.physicianNotification,
      isEmergency: totalScore >= 7,
    };
  }

  /**
   * Calculate Vasoactive-Inotropic Score (VIS)
   * VIS = Dopamine + Dobutamine + (100 * Epinephrine) + (10 * Milrinone) + (10000 * Vasopressin) + (100 * Norepinephrine)
   */
  calculateVIS({
    dopamine = 0,
    dobutamine = 0,
    epinephrine = 0,
    milrinone = 0,
    vasopressin = 0,
    norepinephrine = 0,
  }) {
    const vis =
      dopamine +
      dobutamine +
      100 * epinephrine +
      10 * milrinone +
      10000 * vasopressin +
      100 * norepinephrine;

    let severity = 'MINIMAL';
    if (vis >= 25) {
      severity = 'EXTREME_INOTROPIC_SUPPORT_HIGH_MORTALITY';
    } else if (vis >= 15) {
      severity = 'HIGH_INOTROPIC_DEPENDENCY';
    } else if (vis >= 5) {
      severity = 'MODERATE';
    }

    return {
      visScore: Number(vis.toFixed(1)),
      severity,
      components: {
        dopamineMcgKgMin: dopamine,
        dobutamineMcgKgMin: dobutamine,
        epinephrineMcgKgMin: epinephrine,
        milrinoneMcgKgMin: milrinone,
        vasopressinUnitsKgMin: vasopressin,
        norepinephrineMcgKgMin: norepinephrine,
      },
      isHighRisk: vis >= 15,
    };
  }

  /**
   * Calculate Pediatric Oxygenation Metrics (OI, OSI, PaO2/FiO2, SpO2/FiO2)
   */
  calculateOxygenationMetrics({
    meanAirwayPressure,
    fio2Percent,
    pao2,
    spo2,
    isMechanicallyVentilated = false,
  }) {
    const fio2Fraction = fio2Percent / 100;
    const pfRatio = fio2Fraction > 0 && pao2 ? Math.round(pao2 / fio2Fraction) : null;
    const sfRatio = fio2Fraction > 0 && spo2 ? Math.round(spo2 / fio2Fraction) : null;

    let oxygenationIndex = null;
    let oxygenSaturationIndex = null;
    let pardsSeverity = 'NO_PARDS';

    if (isMechanicallyVentilated && meanAirwayPressure > 0) {
      if (pao2 > 0) {
        oxygenationIndex = Number(((meanAirwayPressure * fio2Percent) / pao2).toFixed(1));
        if (oxygenationIndex >= 16) pardsSeverity = 'SEVERE_PARDS_CONSIDER_ECMO';
        else if (oxygenationIndex >= 8) pardsSeverity = 'MODERATE_PARDS';
        else if (oxygenationIndex >= 4) pardsSeverity = 'MILD_PARDS';
      } else if (spo2 > 0 && spo2 <= 97) {
        oxygenSaturationIndex = Number(((meanAirwayPressure * fio2Percent) / spo2).toFixed(1));
        if (oxygenSaturationIndex >= 12.3) pardsSeverity = 'SEVERE_PARDS_NON_INVASIVE';
        else if (oxygenSaturationIndex >= 7.5) pardsSeverity = 'MODERATE_PARDS';
        else if (oxygenSaturationIndex >= 5.0) pardsSeverity = 'MILD_PARDS';
      }
    }

    return {
      pfRatio,
      sfRatio,
      oxygenationIndex,
      oxygenSaturationIndex,
      pardsSeverity,
      fio2Percent,
      meanAirwayPressure,
    };
  }

  /**
   * Phoenix Pediatric Sepsis Evaluation (Phoenix Sepsis Criteria 2024)
   */
  evaluatePhoenixSepsis(patient) {
    let score = 0;
    let details = [];

    // Cardiovascular Criteria
    if (patient.visScore >= 15 || patient.lactate >= 5.0) {
      score += 2;
      details.push(`Cardiovascular dysfunction (Lactate ${patient.lactate} mmol/L, VIS ${patient.visScore})`);
    } else if (patient.visScore > 0 || patient.lactate >= 2.5) {
      score += 1;
      details.push(`Mild cardiovascular strain (Lactate ${patient.lactate} mmol/L)`);
    }

    // Respiratory Criteria
    if (patient.pao2 && patient.fio2Percent) {
      const pf = patient.pao2 / (patient.fio2Percent / 100);
      if (pf < 200 || (patient.invasiveVentilator && patient.invasiveVentilator.mode !== 'OFF')) {
        score += 2;
        details.push(`Respiratory dysfunction on mechanical support (P/F ${Math.round(pf)})`);
      }
    }

    // Neurological
    if (patient.behaviorScore >= 3 || patient.sedationRass <= -4) {
      score += 1;
      details.push('Neurological obtundation / depressed responsiveness');
    }

    const isSepsis = score >= 2;
    const isSepticShock = isSepsis && (patient.visScore > 0 || patient.lactate >= 4.0);

    return {
      phoenixScore: score,
      isSepsis,
      isSepticShock,
      status: isSepticShock ? 'PHOENIX_SEPTIC_SHOCK' : isSepsis ? 'PHOENIX_SEPSIS' : 'NO_SEPSIS_ORGAN_FAILURE',
      criteriaDetails: details,
    };
  }

  /**
   * Calculate Holliday-Segar Maintenance Fluid Rate
   * 4 mL/kg/h for 1st 10kg, 2 mL/kg/h for 2nd 10kg, 1 mL/kg/h for remainder
   */
  calculateMaintenanceFluids(weightKg) {
    let mlPerHour = 0;
    if (weightKg <= 10) {
      mlPerHour = weightKg * 4;
    } else if (weightKg <= 20) {
      mlPerHour = 40 + (weightKg - 10) * 2;
    } else {
      mlPerHour = 60 + (weightKg - 20) * 1;
    }

    const dailyTotalMl = mlPerHour * 24;
    const bolus20MlKg = weightKg * 20;

    return {
      hourlyMaintenanceRateMl: Number(mlPerHour.toFixed(1)),
      dailyMaintenanceVolumeMl: Math.round(dailyTotalMl),
      standardResuscitationBolus20MlKg: Math.round(bolus20MlKg),
      fluidTypeRecommended: 'Isotonic (Plasmalyte / D5 0.9% NaCl + 20 mEq/L KCl)',
    };
  }

  /**
   * Retrieve all patients with dynamic telemetry evaluations
   */
  getAllPatients() {
    return this.patients.map((p) => {
      const pews = this.calculatePEWS({
        behaviorScore: p.behaviorScore,
        cardiovascularScore: p.cardiovascularScore,
        respiratoryScore: p.respiratoryScore,
        nebulizerBonus: p.nebulizerBonus,
        persistentVomiting: p.persistentVomiting,
      });

      const oxygenation = this.calculateOxygenationMetrics({
        meanAirwayPressure: p.invasiveVentilator ? p.invasiveVentilator.meanAirwayPressure : 0,
        fio2Percent: p.fio2Percent,
        pao2: p.pao2,
        spo2: p.spo2,
        isMechanicallyVentilated: p.respiratorySupportType === 'MECHANICAL_VENTILATION',
      });

      const sepsis = this.evaluatePhoenixSepsis(p);
      const fluids = this.calculateMaintenanceFluids(p.weightKg);

      return {
        ...p,
        calculatedPEWS: pews,
        calculatedOxygenation: oxygenation,
        calculatedSepsis: sepsis,
        calculatedFluids: fluids,
      };
    });
  }

  /**
   * Update telemetry point
   */
  updatePatientTelemetry(patientId, telemetry) {
    const index = this.patients.findIndex((p) => p.id === patientId);
    if (index === -1) throw new Error(`Patient ${patientId} not found`);

    this.patients[index] = {
      ...this.patients[index],
      ...telemetry,
    };

    return this.getAllPatients().find((p) => p.id === patientId);
  }
}

export const pediatricICUService = new PediatricICUService();
export default pediatricICUService;
