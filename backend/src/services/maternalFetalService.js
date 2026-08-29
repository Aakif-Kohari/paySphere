/**
 * Maternal-Fetal Telemetry & High-Risk Obstetric Computation Engine
 * Provides calculation algorithms for NICHD 3-Tier FHR categorization,
 * Montevideo Units (MVU) uterine work index, Bishop Cervical Score,
 * Magnesium Sulfate toxicity staging, and AIM Postpartum Hemorrhage (PPH) escalation.
 */

import {
  NICHD_FHR_CATEGORIES,
  AIM_PPH_STAGES,
  MAGNESIUM_SULFATE_PROTOCOLS,
} from "../models/maternalFetal.model.js";

class MaternalFetalService {
  /**
   * Classifies Fetal Heart Rate (FHR) Tracing according to NICHD 3-Tier Guidelines.
   */
  classifyNICHDCategory({ baseline, variability, decelType, isSinusoidal = false }) {
    if (isSinusoidal || (variability === "ABSENT" && (decelType === "RECURRENT_LATE" || decelType === "RECURRENT_VARIABLE" || baseline < 110))) {
      return {
        category: "CATEGORY_III",
        interpretation: "Abnormal FHR Tracing (Predictive of abnormal fetal acid-base balance).",
        urgency: "CRITICAL_STAT_DELIVERY",
        actions: "STAT Obstetrician at bedside. Prepare for immediate Crash Cesarean Section.",
      };
    }

    if (
      baseline >= 110 &&
      baseline <= 160 &&
      variability === "MODERATE" &&
      decelType !== "RECURRENT_LATE" &&
      decelType !== "RECURRENT_VARIABLE"
    ) {
      return {
        category: "CATEGORY_I",
        interpretation: "Normal FHR Tracing (Predictive of normal fetal acid-base balance).",
        urgency: "ROUTINE_MONITORING",
        actions: "Continue standard intrapartum electronic fetal monitoring.",
      };
    }

    return {
      category: "CATEGORY_II",
      interpretation: "Indeterminate FHR Tracing (Requires continued surveillance and intrauterine resuscitation).",
      urgency: "EVALUATION_RESUSCITATION",
      actions: "Intrauterine Resuscitation: Left lateral position, IV fluid bolus, 10L O2, stop Oxytocin.",
    };
  }

  /**
   * Calculates Montevideo Units (MVU) for labor adequacy.
   * Formula: Contraction Frequency in 10 minutes * Average Contraction Amplitude (mmHg)
   * Adequate Active Labor: 200 - 250 MVU
   */
  calculateMontevideoUnits(contractionFrequency10Min, peakIntensityMmHg) {
    const mvu = Number((contractionFrequency10Min * peakIntensityMmHg).toFixed(0));
    let status = "ADEQUATE_LABOR";
    if (mvu > 300) status = "UTERINE_HYPERSTIMULATION_TACHYSYSTOLE";
    else if (mvu < 200) status = "HYPOTONIC_UTERINE_DYSFUNCTION";

    return { mvu, status };
  }

  /**
   * Evaluates Magnesium Sulfate Infusion Safety & Therapeutic Window.
   */
  evaluatePreeclampsiaMagnesium({ systolicBp, diastolicBp, serumMg, patellarReflexes, urineOutputMlHr }) {
    const isSevereHypertension = systolicBp >= 160 || diastolicBp >= 110;
    let toxicityRisk = "THERAPEUTIC";
    let recommendation = "Maintain current infusion rate.";

    if (serumMg > MAGNESIUM_SULFATE_PROTOCOLS.TOXICITY_THRESHOLDS.respiratoryDepression || patellarReflexes === "0_ABSENT") {
      toxicityRisk = "CRITICAL_MAGNESIUM_TOXICITY";
      recommendation = "DISCONTINUE Magnesium Sulfate IMMEDIATELY. Administer 1g IV Calcium Gluconate (10%) over 3 min.";
    } else if (urineOutputMlHr < 30) {
      toxicityRisk = "OLIGURIA_ACCUMULATION_RISK";
      recommendation = "Oliguria detected (< 30 mL/hr). Decrease maintenance rate to 1g/hr and recheck serum Mg in 2 hours.";
    } else if (serumMg < MAGNESIUM_SULFATE_PROTOCOLS.DOSING.therapeuticSerumRangeMgDl[0]) {
      toxicityRisk = "SUBTHERAPEUTIC";
      recommendation = "Subtherapeutic serum Mg level. Titrate infusion rate to achieve target 4.8 - 8.4 mg/dL.";
    }

    return { isSevereHypertension, serumMg, toxicityRisk, recommendation };
  }

  /**
   * Calculates the Bishop Score for Pre-Induction Cervical Readiness.
   * Score ranges from 0 to 13 (Score >= 8 indicates high likelihood of successful vaginal delivery).
   */
  calculateBishopScore({ dilationCm, effacementPercent, station, consistency, position }) {
    let score = 0;

    // Dilation
    if (dilationCm >= 5) score += 3;
    else if (dilationCm >= 3) score += 2;
    else if (dilationCm >= 1) score += 1;

    // Effacement
    if (effacementPercent >= 80) score += 3;
    else if (effacementPercent >= 60) score += 2;
    else if (effacementPercent >= 40) score += 1;

    // Station (-3 to +3)
    if (station >= 1) score += 3;
    else if (station >= -1) score += 2;
    else if (station >= -2) score += 1;

    // Consistency (soft = 2, medium = 1, firm = 0)
    score += consistency === "SOFT" ? 2 : consistency === "MEDIUM" ? 1 : 0;

    // Position (anterior = 2, mid = 1, posterior = 0)
    score += position === "ANTERIOR" ? 2 : position === "MID" ? 1 : 0;

    const isFavorable = score >= 8;
    return {
      score,
      isFavorable,
      recommendation: isFavorable
        ? "Favorable Cervix (Bishop >= 8). Proceed with amniotomy or Oxytocin induction."
        : "Unfavorable Cervix (Bishop < 6). Cervical ripening indicated (Dinoprostone / Misoprostol / Foley balloon).",
    };
  }

  /**
   * Evaluates AIM Postpartum Hemorrhage (PPH) Stage & Protocol Escalation.
   */
  stageAIMPostpartumHemorrhage({ qblMl, heartRate, systolicBp, isCesarean = false }) {
    const thresholdStage1 = isCesarean ? 1000 : 500;
    const shockIndex = Number((heartRate / systolicBp).toFixed(2));

    let stage = "NORMAL";
    if (qblMl >= 1500 || shockIndex >= 0.9) {
      stage = "STAGE_3";
    } else if (qblMl >= 1000) {
      stage = "STAGE_2";
    } else if (qblMl >= thresholdStage1) {
      stage = "STAGE_1";
    }

    return {
      qblMl,
      shockIndex,
      stage,
      protocol: AIM_PPH_STAGES[stage] || null,
      isMTPRequired: stage === "STAGE_3",
    };
  }

  /**
   * Serializes Maternal-Fetal Telemetry into HL7 FHIR R4 Bundle Observation resources.
   */
  exportHL7FHIRBundle(patientData, readingHistory = []) {
    const bundleId = `bundle-ob-${patientData.id}-${Date.now()}`;
    const fhirObservations = readingHistory.map((item, index) => ({
      resourceType: "Observation",
      id: `obs-fhr-${index}-${Date.now()}`,
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
          { system: "http://loinc.org", code: "55283-6", display: "Fetal Heart Rate" },
          { system: "http://loinc.org", code: "55284-4", display: "Uterine Contraction Frequency" },
        ],
        text: "Maternal-Fetal CTG Telemetry",
      },
      subject: {
        reference: `Patient/${patientData.id}`,
        display: patientData.name,
      },
      effectiveDateTime: item.timestamp || new Date().toISOString(),
      component: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "55283-6", display: "FHR" }] },
          valueQuantity: { value: item.fhr, unit: "beats/min", system: "http://unitsofmeasure.org", code: "/min" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "55284-4", display: "TOCO" }] },
          valueQuantity: { value: item.toco, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
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

export const maternalFetalService = new MaternalFetalService();
export default maternalFetalService;
