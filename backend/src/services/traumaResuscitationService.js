/**
 * Trauma Resuscitation, Massive Transfusion & Coagulopathy Computation Engine
 * Provides calculation algorithms for Assessment of Blood Consumption (ABC),
 * Shock Index (SI), Goal-Directed Thromboelastography (TEG 6s / ROTEM),
 * 1:1:1 Balanced MTP Ratio Tracking, Lethal Triad Surveillance,
 * and HL7 FHIR R4 Bundle Serialization.
 */

import {
  TEG_ROTEM_THRESHOLDS,
  MTP_COOLER_PACKS,
  DAMAGE_CONTROL_TARGETS,
  EMERGENCY_TRAUMA_PROTOCOLS,
} from "../models/traumaResuscitation.model.js";

class TraumaResuscitationService {
  /**
   * Calculates Shock Index (SI).
   * Formula: SI = Heart Rate (BPM) / Systolic Blood Pressure (mmHg)
   */
  calculateShockIndex(heartRateBpm, systolicBpMmHg) {
    if (!systolicBpMmHg || systolicBpMmHg <= 0) return { shockIndex: 0, status: "INVALID_BP" };
    const shockIndex = Number((heartRateBpm / systolicBpMmHg).toFixed(2));
    let status = "NORMAL";
    let risk = "LOW";

    if (shockIndex >= 1.3) {
      status = "SEVERE_EXSANGUINATING_SHOCK";
      risk = "CRITICAL";
    } else if (shockIndex >= 0.9) {
      status = "ELEVATED_HEMORRHAGIC_SHOCK";
      risk = "HIGH_ALERT";
    } else if (shockIndex < 0.5) {
      status = "LOW_INDEX";
      risk = "NORMAL";
    }

    return { shockIndex, status, risk };
  }

  /**
   * Calculates Assessment of Blood Consumption (ABC) Score.
   * Parameters: Penetrating Mechanism (+1), SBP <= 90 (+1), HR >= 120 (+1), Positive FAST (+1)
   */
  calculateABCScore({ isPenetrating = false, sbp = 120, hr = 80, isFastPositive = false }) {
    let score = 0;
    if (isPenetrating) score += 1;
    if (sbp <= 90) score += 1;
    if (hr >= 120) score += 1;
    if (isFastPositive) score += 1;

    const isMTPIndicated = score >= 2;
    const probabilityPercent = isMTPIndicated ? (score === 4 ? 95 : score === 3 ? 85 : 75) : (score === 1 ? 25 : 5);

    return {
      score,
      isMTPIndicated,
      probabilityPercent,
      recommendation: isMTPIndicated
        ? "MTP Activation Strongly Indicated (ABC >= 2). Order Cooler 1 immediately."
        : "Standard Hemostatic Resuscitation. Monitor for dynamic hemodynamic failure.",
    };
  }

  /**
   * Evaluates Goal-Directed TEG 6s Parameters and outputs blood component guidance.
   */
  evaluateTEGProfile({ rTime, kTime, alphaAngle, ma, ly30 }) {
    const recommendations = [];

    // R-Time -> FFP / PCC
    if (rTime > TEG_ROTEM_THRESHOLDS.R_TIME_CLOTTING_FACTORS.abnormalProlonged) {
      recommendations.push({
        parameter: "R-Time",
        value: `${rTime} min`,
        defect: "Clotting Factor Deficiency / Anticoagulant Effect",
        action: "Transfuse 2-4 units Fresh Frozen Plasma (FFP) or 4-Factor PCC",
      });
    }

    // Alpha Angle / K-Time -> Cryoprecipitate
    if (alphaAngle < TEG_ROTEM_THRESHOLDS.ALPHA_ANGLE_POLYMERIZATION.abnormalLow) {
      recommendations.push({
        parameter: "Alpha Angle",
        value: `${alphaAngle}°`,
        defect: "Fibrinogen Deficiency / Impaired Crosslinking",
        action: "Administer 1-2 pools Cryoprecipitate (Target Fibrinogen > 150 mg/dL)",
      });
    }

    // Maximum Amplitude (MA) -> Platelets
    if (ma < TEG_ROTEM_THRESHOLDS.MAXIMUM_AMPLITUDE_PLATELETS.abnormalLow) {
      recommendations.push({
        parameter: "Maximum Amplitude (MA)",
        value: `${ma} mm`,
        defect: "Platelet Dysfunction / Severe Thrombocytopenia",
        action: "Transfuse 1 unit Platelet Apheresis (+ consider DDAVP 0.3 mcg/kg)",
      });
    }

    // LY30 -> TXA
    if (ly30 > TEG_ROTEM_THRESHOLDS.LY30_HYPERFIBRINOLYSIS.criticalHyperfibrinolysis) {
      recommendations.push({
        parameter: "LY30",
        value: `${ly30}%`,
        defect: "Primary Hyperfibrinolysis (Clot Dissolution)",
        action: "Administer Tranexamic Acid (TXA) 1g IV push over 10 min stat",
      });
    }

    return {
      isCoagulopathic: recommendations.length > 0,
      recommendations,
      summary: recommendations.length > 0
        ? `TEG Guided Coagulopathy: ${recommendations.map((r) => r.parameter).join(", ")} abnormalities detected.`
        : "Normal TEG Coagulation Dynamics.",
    };
  }

  /**
   * Calculates MTP Product Ratio and Identifies Imbalances.
   * Target: Balanced 1:1:1 (PRBC : FFP : Platelet Apheresis equivalent)
   */
  calculateMTPTransfusionRatios({ prbc, ffp, platelets, cryo = 0 }) {
    const ffpToPrbcRatio = prbc > 0 ? Number((ffp / prbc).toFixed(2)) : 1.0;
    const isBalanced = ffpToPrbcRatio >= 0.8 && ffpToPrbcRatio <= 1.2;

    return {
      prbcUnits: prbc,
      ffpUnits: ffp,
      plateletUnits: platelets,
      cryoUnits: cryo,
      ffpToPrbcRatio,
      isBalanced,
      warning: !isBalanced && prbc >= 4
        ? "Imbalanced Resuscitation Ratio: Increase FFP to prevent dilutional coagulopathy."
        : null,
    };
  }

  /**
   * Assesses Trauma Lethal Triad (Hypothermia, Acidosis, Coagulopathy).
   */
  checkLethalTriadRisk({ temperatureC, ph, baseDeficit, ionizedCalcium }) {
    const isHypothermic = temperatureC < DAMAGE_CONTROL_TARGETS.BODY_CORE_TEMPERATURE.criticalLethalTriadC;
    const isAcidotic = ph < 7.20 || baseDeficit < DAMAGE_CONTROL_TARGETS.SERUM_LACTATE_BASE_DEFICIT.baseDeficitSevereMeq;
    const isHypocalcemic = ionizedCalcium < DAMAGE_CONTROL_TARGETS.IONIZED_CALCIUM.criticalCitrateToxicityMin;

    let triadCount = 0;
    if (isHypothermic) triadCount++;
    if (isAcidotic) triadCount++;
    if (isHypocalcemic) triadCount++;

    return {
      triadCount,
      isHypothermic,
      isAcidotic,
      isHypocalcemic,
      severity: triadCount >= 2 ? "CRITICAL_LETHAL_TRIAD" : triadCount === 1 ? "WARNING" : "STABLE",
      recommendation: triadCount >= 2
        ? "CRITICAL: Lethal Triad present. Abort definitive reconstruction; initiate Damage Control Surgery & Active Core Rewarming."
        : "Maintain core warming and ionized calcium monitoring.",
    };
  }

  /**
   * Serializes Trauma Telemetry into HL7 FHIR R4 Bundle Observation resources.
   */
  exportHL7FHIRBundle(patientData, readingHistory = []) {
    const bundleId = `bundle-trauma-${patientData.id}-${Date.now()}`;
    const fhirObservations = readingHistory.map((item, index) => ({
      resourceType: "Observation",
      id: `obs-trauma-${index}-${Date.now()}`,
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs",
            },
          ],
        },
      ],
      code: {
        coding: [
          { system: "http://loinc.org", code: "8867-4", display: "Heart rate" },
          { system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" },
          { system: "http://loinc.org", code: "89276-0", display: "Shock Index" },
        ],
        text: "Trauma Resuscitation Hemodynamics",
      },
      subject: {
        reference: `Patient/${patientData.id}`,
        display: patientData.name,
      },
      effectiveDateTime: item.timestamp || new Date().toISOString(),
      component: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart Rate" }] },
          valueQuantity: { value: item.hr, unit: "beats/min", system: "http://unitsofmeasure.org", code: "/min" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }] },
          valueQuantity: { value: item.sbp, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "89276-0", display: "Shock Index" }] },
          valueQuantity: { value: item.shockIndex, unit: "ratio", system: "http://unitsofmeasure.org", code: "1" },
        },
      ],
    }));

    return {
      resourceType: "Bundle",
      id: bundleId,
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: fhirObservations.map((obs) => ({ resource: obs })),
    };
  }
}

export const traumaResuscitationService = new TraumaResuscitationService();
export default traumaResuscitationService;
