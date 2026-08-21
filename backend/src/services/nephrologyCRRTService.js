/**
 * Nephrology CRRT & Renal Replacement Therapy Clinical Calculation Engine
 * High-assurance mathematical formulations adhering to KDIGO 2024, ADQI XXIV, and Stewart Acid-Base principles.
 */

import {
  KDIGO_STAGES,
  CRRT_SAFETY_THRESHOLDS,
  ANTICOAGULATION_PROTOCOLS,
  INITIAL_NEPHROLOGY_PATIENTS,
} from '../models/nephrologyCRRT.model.js';

class NephrologyCRRTService {
  constructor() {
    this.patients = JSON.parse(JSON.stringify(INITIAL_NEPHROLOGY_PATIENTS));
  }

  /**
   * Calculate KDIGO AKI Staging
   * @param {number} baselineCreatinine - Baseline serum creatinine (mg/dL)
   * @param {number} currentCreatinine - Current serum creatinine (mg/dL)
   * @param {number} urineOutputMlKgHr - Average urine output over last 6-24h (mL/kg/h)
   * @param {boolean} onRRT - Whether patient is currently on renal replacement therapy
   * @returns {object} KDIGO Stage metadata and clinical recommendations
   */
  calculateKdigoStage(baselineCreatinine, currentCreatinine, urineOutputMlKgHr, onRRT = false) {
    if (onRRT) {
      return {
        ...KDIGO_STAGES.STAGE_3,
        criterionMet: 'Patient on Active Renal Replacement Therapy (RRT)',
      };
    }

    const creatinineRatio = baselineCreatinine > 0 ? currentCreatinine / baselineCreatinine : 1.0;
    const absoluteIncrease = currentCreatinine - baselineCreatinine;

    if (creatinineRatio >= 3.0 || currentCreatinine >= 4.0 || urineOutputMlKgHr < 0.3) {
      return {
        ...KDIGO_STAGES.STAGE_3,
        criterionMet: creatinineRatio >= 3.0
          ? `Creatinine >= 3.0x baseline (${creatinineRatio.toFixed(2)}x)`
          : currentCreatinine >= 4.0
          ? `Creatinine >= 4.0 mg/dL (${currentCreatinine.toFixed(2)} mg/dL)`
          : `Oliguria < 0.3 mL/kg/h (${urineOutputMlKgHr.toFixed(2)} mL/kg/h)`,
      };
    }

    if (creatinineRatio >= 2.0 || (urineOutputMlKgHr < 0.5 && urineOutputMlKgHr >= 0.3)) {
      return {
        ...KDIGO_STAGES.STAGE_2,
        criterionMet: creatinineRatio >= 2.0
          ? `Creatinine 2.0 - 2.9x baseline (${creatinineRatio.toFixed(2)}x)`
          : `Oliguria < 0.5 mL/kg/h for >= 12h (${urineOutputMlKgHr.toFixed(2)} mL/kg/h)`,
      };
    }

    if (creatinineRatio >= 1.5 || absoluteIncrease >= 0.3) {
      return {
        ...KDIGO_STAGES.STAGE_1,
        criterionMet: absoluteIncrease >= 0.3
          ? `Creatinine increase >= 0.3 mg/dL (+${absoluteIncrease.toFixed(2)} mg/dL)`
          : `Creatinine 1.5 - 1.9x baseline (${creatinineRatio.toFixed(2)}x)`,
      };
    }

    return {
      ...KDIGO_STAGES.STAGE_0,
      criterionMet: 'Preserved renal baseline metrics',
    };
  }

  /**
   * Calculate Total Delivered Effluent Dose (mL/kg/h) with pre-dilution urea dilution correction
   * KDIGO recommends 20 - 25 mL/kg/h delivered dose (prescribe 25 - 30 mL/kg/h to account for downtime).
   * @param {object} params
   * @param {number} params.weightKg - Patient body weight (kg)
   * @param {number} params.bloodFlowRate - Qb in mL/min
   * @param {number} params.dialysateRate - Qd in mL/h
   * @param {number} params.preReplacementRate - Qpre in mL/h
   * @param {number} params.postReplacementRate - Qpost in mL/h
   * @param {number} params.netUltrafiltrationRate - Quf in mL/h
   * @param {number} [params.hematocrit=0.30] - Patient hematocrit fraction (0.25 - 0.45)
   * @returns {object} Effluent dose calculation details
   */
  calculateEffluentDose({
    weightKg,
    bloodFlowRate,
    dialysateRate,
    preReplacementRate,
    postReplacementRate,
    netUltrafiltrationRate,
    hematocrit = 0.30,
  }) {
    const totalEffluentRateMlPerHour =
      dialysateRate + preReplacementRate + postReplacementRate + netUltrafiltrationRate;

    const nominalDoseMlKgHr = weightKg > 0 ? totalEffluentRateMlPerHour / weightKg : 0;

    // Blood water flow rate (Qbw in mL/h)
    const bloodWaterFlowRateMlPerHour = bloodFlowRate * 60 * (1 - hematocrit);

    // Pre-dilution correction factor for convective clearance
    const preDilutionFactor =
      preReplacementRate > 0 && bloodWaterFlowRateMlPerHour > 0
        ? bloodWaterFlowRateMlPerHour / (bloodWaterFlowRateMlPerHour + preReplacementRate)
        : 1.0;

    // Corrected delivered convective / diffusive dose
    const effectivePreReplacement = preReplacementRate * preDilutionFactor;
    const effectiveConvectiveDose =
      (effectivePreReplacement + postReplacementRate + netUltrafiltrationRate) / (weightKg || 1);
    const effectiveDiffusiveDose = dialysateRate / (weightKg || 1);
    const trueDeliveredDoseMlKgHr =
      (dialysateRate + effectivePreReplacement + postReplacementRate + netUltrafiltrationRate) /
      (weightKg || 1);

    let doseStatus = 'OPTIMAL';
    if (trueDeliveredDoseMlKgHr < 20) {
      doseStatus = 'SUBTHERAPEUTIC';
    } else if (trueDeliveredDoseMlKgHr > 35) {
      doseStatus = 'HIGH_INTENSITY';
    }

    return {
      nominalDoseMlKgHr: Number(nominalDoseMlKgHr.toFixed(1)),
      trueDeliveredDoseMlKgHr: Number(trueDeliveredDoseMlKgHr.toFixed(1)),
      preDilutionCorrectionFactor: Number(preDilutionFactor.toFixed(3)),
      effectiveConvectiveDose: Number(effectiveConvectiveDose.toFixed(1)),
      effectiveDiffusiveDose: Number(effectiveDiffusiveDose.toFixed(1)),
      totalEffluentFlowRate: totalEffluentRateMlPerHour,
      doseStatus,
      targetGuideline: 'KDIGO 20 - 25 mL/kg/h delivered dose',
    };
  }

  /**
   * Calculate Circuit Filtration Fraction (%)
   * FF = (Qpre + Qpost + Quf) / [Qb * 60 * (1 - Hct)] * 100
   * Target < 20-25% to prevent hemofilter hemoconcentration, protein gel polarization, and thrombosis.
   */
  calculateFiltrationFraction({
    bloodFlowRate,
    preReplacementRate,
    postReplacementRate,
    netUltrafiltrationRate,
    hematocrit = 0.30,
  }) {
    const totalConvectiveRemovalMlPerHour =
      preReplacementRate + postReplacementRate + netUltrafiltrationRate;
    const plasmaFlowRateMlPerHour = bloodFlowRate * 60 * (1 - hematocrit);

    if (plasmaFlowRateMlPerHour <= 0) return { filtrationFraction: 0, status: 'ERROR' };

    const filtrationFraction = (totalConvectiveRemovalMlPerHour / plasmaFlowRateMlPerHour) * 100;

    let status = 'NORMAL';
    if (filtrationFraction > CRRT_SAFETY_THRESHOLDS.FILTRATION_FRACTION_MAX) {
      status = 'CRITICAL_HIGH_CLOTTING_RISK';
    } else if (filtrationFraction > 20) {
      status = 'ELEVATED';
    }

    return {
      filtrationFraction: Number(filtrationFraction.toFixed(1)),
      plasmaFlowRateMlPerHour: Math.round(plasmaFlowRateMlPerHour),
      totalConvectiveRemovalMlPerHour,
      status,
      maxSafeThreshold: CRRT_SAFETY_THRESHOLDS.FILTRATION_FRACTION_MAX,
    };
  }

  /**
   * Calculate Transmembrane Pressure (TMP) and Filter Pressure Drop (dP)
   * TMP = (Pfilter + Pvenous) / 2 - Peffluent
   * dP = Pfilter - Pvenous
   */
  calculateCircuitPressures(filterPressure, venousPressure, effluentPressure, accessPressure) {
    const tmp = (filterPressure + venousPressure) / 2 - effluentPressure;
    const pressureDrop = filterPressure - venousPressure;

    let tmpStatus = 'NOMINAL';
    if (tmp >= CRRT_SAFETY_THRESHOLDS.TMP_MAX_CRITICAL) {
      tmpStatus = 'CRITICAL_CLOTTING_IMMINENT';
    } else if (tmp >= CRRT_SAFETY_THRESHOLDS.TMP_MAX_WARNING) {
      tmpStatus = 'WARNING_MEMBRANE_FOULING';
    }

    let pressureDropStatus = 'NOMINAL';
    if (pressureDrop >= CRRT_SAFETY_THRESHOLDS.PRESSURE_DROP_CRITICAL) {
      pressureDropStatus = 'CRITICAL_HOLLOW_FIBER_OBSTRUCTION';
    } else if (pressureDrop >= CRRT_SAFETY_THRESHOLDS.PRESSURE_DROP_WARNING) {
      pressureDropStatus = 'ELEVATED_RESISTANCE';
    }

    return {
      transmembranePressure: Math.round(tmp),
      filterPressureDrop: Math.round(pressureDrop),
      accessPressure,
      tmpStatus,
      pressureDropStatus,
      isMembraneEndangered: tmpStatus !== 'NOMINAL' || pressureDropStatus !== 'NOMINAL',
    };
  }

  /**
   * Regional Citrate Anticoagulation (RCA) Safety & Citrate Lock Surveillance
   * Total Ca (mmol/L) / Ionized Ca (mmol/L) > 2.5 is diagnostic of Citrate Accumulation / Toxicity.
   */
  evaluateCitrateSafety(totalCalciumMgDl, systemicIonizedCalciumMmolL, postFilterIonizedCalciumMmolL) {
    // Convert Total Calcium mg/dL to mmol/L (divide by 4.008)
    const totalCalciumMmolL = totalCalciumMgDl / 4.008;
    const ratio = systemicIonizedCalciumMmolL > 0 ? totalCalciumMmolL / systemicIonizedCalciumMmolL : 0;

    let citrateLockDetected = ratio >= CRRT_SAFETY_THRESHOLDS.TOTAL_CA_TO_IONIZED_CA_RATIO_ALERT;
    let postFilterAnticoagulationStatus = 'ADEQUATE';

    if (postFilterIonizedCalciumMmolL > 0.40) {
      postFilterAnticoagulationStatus = 'UNDER_ANTICOAGULATED_INCREASE_CITRATE';
    } else if (postFilterIonizedCalciumMmolL < 0.20) {
      postFilterAnticoagulationStatus = 'OVER_ANTICOAGULATED_DECREASE_CITRATE';
    }

    let systemicCalciumStatus = 'EU_CALCEMIC';
    if (systemicIonizedCalciumMmolL < 1.10) {
      systemicCalciumStatus = 'SYSTEMIC_HYPOCALCEMIA_INCREASE_CA_INFUSION';
    } else if (systemicIonizedCalciumMmolL > 1.35) {
      systemicCalciumStatus = 'SYSTEMIC_HYPERCALCEMIA_DECREASE_CA_INFUSION';
    }

    return {
      totalCalciumMmolL: Number(totalCalciumMmolL.toFixed(2)),
      systemicIonizedCalciumMmolL,
      postFilterIonizedCalciumMmolL,
      totToIonizedCaRatio: Number(ratio.toFixed(2)),
      citrateLockDetected,
      postFilterAnticoagulationStatus,
      systemicCalciumStatus,
      recommendation: citrateLockDetected
        ? 'EMERGENCY: Stop or drastically reduce Citrate infusion. Switch to Systemic Heparin or Saline Flushes due to impaired hepatic citrate metabolism.'
        : 'Citrate metabolism kinetics within safe homeostatic margins.',
    };
  }

  /**
   * Calculate Fluid Overload Percentage (FO %)
   * FO% = (Cumulative Fluid Balance in Liters / Admission Body Weight in kg) * 100
   * Clinical threshold: FO% > 10% associated with >2x increased ICU mortality.
   */
  calculateFluidOverload(fluidBalanceMl, admissionWeightKg) {
    const fluidBalanceLiters = fluidBalanceMl / 1000;
    const fluidOverloadPercent = admissionWeightKg > 0 ? (fluidBalanceLiters / admissionWeightKg) * 100 : 0;

    let status = 'EUVOLEMIC';
    if (fluidOverloadPercent >= 15) {
      status = 'SEVERE_FLUID_OVERLOAD_HIGH_MORTALITY_RISK';
    } else if (fluidOverloadPercent >= 10) {
      status = 'SIGNIFICANT_FLUID_OVERLOAD_ADQI_TRIGGER';
    } else if (fluidOverloadPercent >= 5) {
      status = 'MILD_HYPERVOLEMIA';
    } else if (fluidOverloadPercent < -5) {
      status = 'HYPOVOLEMIC_DEHYDRATION';
    }

    return {
      fluidBalanceMl,
      fluidOverloadPercent: Number(fluidOverloadPercent.toFixed(1)),
      status,
      recommendedNetUfRate: fluidOverloadPercent > 10 ? '200 - 350 mL/h' : '50 - 150 mL/h',
    };
  }

  /**
   * Filter Lifespan & Circuit Clotting Hazard AI Prediction Score (0 - 100%)
   */
  predictCircuitClottingRisk(patient) {
    let risk = 5;

    // TMP contribution
    if (patient.transmembranePressure > 200) risk += 35;
    else if (patient.transmembranePressure > 150) risk += 18;

    // Filter Pressure Drop contribution
    if (patient.filterPressureDrop > 120) risk += 30;
    else if (patient.filterPressureDrop > 80) risk += 15;

    // Filtration Fraction contribution
    if (patient.filtrationFraction > 25) risk += 25;
    else if (patient.filtrationFraction > 20) risk += 12;

    // Filter Run Time contribution (older circuits clot faster)
    if (patient.filterRunHours > 60) risk += 20;
    else if (patient.filterRunHours > 48) risk += 10;

    // Anticoagulation penalty
    if (patient.anticoagulationMode === 'NONE_SALINE_FLUSH') risk += 25;

    const clampedRisk = Math.min(100, Math.max(0, Math.round(risk)));
    const estimatedRemainingHours = Math.max(
      0.5,
      Number((72 - patient.filterRunHours) * (1 - clampedRisk / 100)).toFixed(1)
    );

    return {
      clottingRiskScore: clampedRisk,
      estimatedRemainingHours: Number(estimatedRemainingHours),
      status: clampedRisk > 60 ? 'HIGH_CLOTTING_PROBABILITY' : clampedRisk > 30 ? 'MODERATE' : 'LOW',
    };
  }

  /**
   * Retrieve all active nephrology patients
   */
  getAllPatients() {
    return this.patients.map((p) => {
      const kdigo = this.calculateKdigoStage(p.creatinineBaseline, p.creatinineCurrent, p.urineOutputLastHour / p.weightKg, true);
      const dose = this.calculateEffluentDose({
        weightKg: p.weightKg,
        bloodFlowRate: p.bloodFlowRate,
        dialysateRate: p.dialysateFlowRate,
        preReplacementRate: p.preReplacementRate,
        postReplacementRate: p.postReplacementRate,
        netUltrafiltrationRate: p.netUltrafiltrationRate,
      });
      const ff = this.calculateFiltrationFraction({
        bloodFlowRate: p.bloodFlowRate,
        preReplacementRate: p.preReplacementRate,
        postReplacementRate: p.postReplacementRate,
        netUltrafiltrationRate: p.netUltrafiltrationRate,
      });
      const pressures = this.calculateCircuitPressures(p.filterPressure, p.venousPressure, p.effluentPressure, p.accessPressure);
      const citrate = this.evaluateCitrateSafety(p.totalSerumCalcium, p.systemicIonizedCalcium, p.postFilterIonizedCalcium);
      const fo = this.calculateFluidOverload(p.fluidBalance24h, p.weightKg);
      const clotRisk = this.predictCircuitClottingRisk(p);

      return {
        ...p,
        calculatedKdigo: kdigo,
        calculatedDose: dose,
        calculatedFF: ff,
        calculatedPressures: pressures,
        calculatedCitrate: citrate,
        calculatedFluidOverload: fo,
        calculatedClotRisk: clotRisk,
      };
    });
  }

  /**
   * Update patient telemetry snapshot
   */
  updatePatientTelemetry(patientId, telemetryUpdates) {
    const index = this.patients.findIndex((p) => p.id === patientId);
    if (index === -1) throw new Error(`Patient ${patientId} not found`);

    this.patients[index] = {
      ...this.patients[index],
      ...telemetryUpdates,
    };

    return this.getAllPatients().find((p) => p.id === patientId);
  }
}

export const nephrologyCRRTService = new NephrologyCRRTService();
export default nephrologyCRRTService;
