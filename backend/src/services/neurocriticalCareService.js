/**
 * Multimodal Neurocritical Care & ICP Computation Engine
 * Provides validated calculation algorithms for Brain Trauma Foundation (BTF) targets,
 * Pressure Reactivity Index (PRx) Autoregulation, PbtO2 Brain Tissue Oxygenation,
 * Quantitative Pupillometry (NPi), TCD Lindegaard Ratio, SIBICC Tier Escalation,
 * Hyperosmolar Dosing Calculations, and HL7 FHIR R4 Bundle Serialization.
 */

import {
  NEURO_MONITORING_MODALITIES,
  SIBICC_TIER_PROTOCOLS,
  LUNDBERG_WAVE_CLASSIFICATION,
  EMERGENCY_NEURO_PROTOCOLS,
} from "../models/neurocriticalCare.model.js";

class NeurocriticalCareService {
  /**
   * Calculates Cerebral Perfusion Pressure (CPP).
   * Formula: CPP = Mean Arterial Pressure (MAP) - Intracranial Pressure (ICP)
   * @param {number} map - MAP in mmHg
   * @param {number} icp - ICP in mmHg
   * @returns {object} { cpp, status, riskLevel }
   */
  calculateCerebralPerfusionPressure(map, icp) {
    const cpp = Number((map - icp).toFixed(1));
    let status = "OPTIMAL";
    let riskLevel = "NORMAL";

    if (cpp < NEURO_MONITORING_MODALITIES.ICP_CPP.criticalLowCPP) {
      status = "CRITICAL_ISCHEMIA_RISK";
      riskLevel = "CRITICAL";
    } else if (cpp < NEURO_MONITORING_MODALITIES.ICP_CPP.targetCPP[0]) {
      status = "SUBOPTIMAL_HYPOPERFUSION";
      riskLevel = "WARNING";
    } else if (cpp > NEURO_MONITORING_MODALITIES.ICP_CPP.criticalHighCPP) {
      status = "HYPERPERFUSION_VASOGENIC_EDEMA_RISK";
      riskLevel = "WARNING";
    }

    return { cpp, status, riskLevel };
  }

  /**
   * Evaluates Pressure Reactivity Index (PRx) Autoregulation.
   * PRx is the moving correlation coefficient between slow waves of MAP and ICP.
   * @param {number} prx - Value between -1.0 and +1.0
   * @param {number} currentCpp - Current CPP in mmHg
   * @param {number} optimalCpp - Autoregulation-guided optimal CPP (CPPopt)
   */
  assessAutoregulation(prx, currentCpp, optimalCpp = 70) {
    let state = "INTACT";
    let description = "Vascular smooth muscle actively reacts to pressure fluctuations.";

    if (prx > 0.3) {
      state = "IMPAIRED";
      description = "Loss of autoregulation. Cerebral vasculature behaves as a passive conduit; ICP varies directly with MAP.";
    } else if (prx > 0.2) {
      state = "BORDERLINE";
      description = "Transitional autoregulatory capacity. Monitor closely during blood pressure changes.";
    }

    const deltaFromOptimal = Number((currentCpp - optimalCpp).toFixed(1));
    return {
      prx,
      state,
      description,
      optimalCpp,
      deltaFromOptimal,
      isAtOptimal: Math.abs(deltaFromOptimal) <= 5,
    };
  }

  /**
   * Assesses Brain Tissue Oxygenation (PbtO2).
   * @param {number} pbtO2 - PbtO2 in mmHg
   */
  classifyBrainOxygenation(pbtO2) {
    let status = "NORMIC";
    let alertLevel = "SAFE";
    let recommendation = "Maintain baseline neuro-intensive ventilatory and hemodynamic parameters.";

    if (pbtO2 < NEURO_MONITORING_MODALITIES.PBTO2_OXYGENATION.severeIschemia) {
      status = "SEVERE_CELLULAR_ISCHEMIA";
      alertLevel = "CRITICAL";
      recommendation = "Emergency escalation: Increase CPP target > 70 mmHg, optimize PaO2 > 100 mmHg, verify transfusion Hb > 9 g/dL.";
    } else if (pbtO2 < NEURO_MONITORING_MODALITIES.PBTO2_OXYGENATION.cautionHypoxia) {
      status = "BRAIN_TISSUE_HYPOXIA";
      alertLevel = "WARNING";
      recommendation = "Assess EVD patency, FiO2/PaO2 targets, and check for subclinical seizure activity.";
    }

    return { pbtO2, status, alertLevel, recommendation };
  }

  /**
   * Evaluates Automated Quantitative Infrared Pupillometry.
   * Calculates Anisocoria and Neurological Pupil index (NPi) scores.
   */
  evaluatePupillometry(npiLeft, npiRight, sizeLeft, sizeRight) {
    const anisocoriaMm = Number(Math.abs(sizeLeft - sizeRight).toFixed(1));
    const isAnisocoric = anisocoriaMm >= 1.0;

    const leftAbnormal = npiLeft < 3.0;
    const rightAbnormal = npiRight < 3.0;
    const leftAtonic = npiLeft === 0;
    const rightAtonic = npiRight === 0;

    let uncalHerniationRisk = "LOW";
    if (leftAtonic || rightAtonic || (isAnisocoric && (leftAbnormal || rightAbnormal))) {
      uncalHerniationRisk = "IMMINENT_HERNIATION";
    } else if (leftAbnormal || rightAbnormal) {
      uncalHerniationRisk = "ELEVATED_RISK";
    }

    return {
      anisocoriaMm,
      isAnisocoric,
      leftStatus: leftAtonic ? "NON_REACTIVE" : leftAbnormal ? "ABNORMAL_SLUGGISH" : "NORMAL",
      rightStatus: rightAtonic ? "NON_REACTIVE" : rightAbnormal ? "ABNORMAL_SLUGGISH" : "NORMAL",
      uncalHerniationRisk,
    };
  }

  /**
   * Calculates TCD Lindegaard Ratio for vasospasm distinction.
   * Lindegaard Ratio (LR) = MCA Mean Flow Velocity (Vmca) / Extracranial ICA Mean Flow Velocity (Vica)
   */
  calculateLindegaardRatio(vMca, vIca = 30) {
    if (!vIca || vIca <= 0) return { ratio: 0, interpretation: "INVALID_ICA_FLOW" };
    const ratio = Number((vMca / vIca).toFixed(2));
    let interpretation = "NORMAL_FLOW";

    if (vMca >= 200 && ratio >= 6.0) {
      interpretation = "SEVERE_VASOSPASM";
    } else if (vMca >= 120 && ratio >= 3.0) {
      interpretation = "MILD_TO_MODERATE_VASOSPASM";
    } else if (vMca >= 120 && ratio < 3.0) {
      interpretation = "HYPEREMIA_ACCELERATED_FLOW";
    }

    return { ratio, vMca, vIca, interpretation };
  }

  /**
   * Calculates the Full Outline of UnResponsiveness (FOUR) Score.
   * Ranges from 0 to 16 (Eye: 0-4, Motor: 0-4, Brainstem: 0-4, Respiration: 0-4)
   */
  calculateFOURScore({ eye, motor, brainstem, respiration }) {
    const total = (eye || 0) + (motor || 0) + (brainstem || 0) + (respiration || 0);
    let severity = "MILD_IMPAIRMENT";
    if (total <= 4) severity = "VERY_POOR_PROGNOSIS_DEEP_COMA";
    else if (total <= 8) severity = "SEVERE_COMA";
    else if (total <= 12) severity = "MODERATE_COMA";

    return { total, eye, motor, brainstem, respiration, severity };
  }

  /**
   * Calculates the Glasgow Coma Scale (GCS).
   * Ranges from 3 to 15 (Eye: 1-4, Verbal: 1-5, Motor: 1-6)
   */
  calculateGCS({ eye, verbal, motor }) {
    const total = (eye || 1) + (verbal || 1) + (motor || 1);
    let category = "SEVERE_TBI";
    if (total >= 13) category = "MILD_TBI";
    else if (total >= 9) category = "MODERATE_TBI";

    return { total, eye, verbal, motor, category };
  }

  /**
   * Formulates SIBICC Tier Recommendation based on real-time parameters.
   */
  recommendSIBICCTier(icp, pbtO2, currentTier = "TIER_0") {
    let recommendedTier = "TIER_0";
    let reasoning = "Intracranial pressure and brain tissue oxygenation within safe thresholds.";

    if (icp > 25 || pbtO2 < 15) {
      recommendedTier = "TIER_3";
      reasoning = "Refractory intracranial hypertension / severe ischemia. Consider barbiturate coma or surgical craniectomy.";
    } else if (icp > 22 || pbtO2 < 20) {
      recommendedTier = currentTier === "TIER_0" ? "TIER_1" : "TIER_2";
      reasoning = "Sustained ICP > 22 mmHg or PbtO2 < 20 mmHg. Escalate osmolar therapy and consider neuromuscular blockade.";
    }

    return {
      currentTier,
      recommendedTier,
      isEscalationRequired: recommendedTier > currentTier,
      reasoning,
      tierProtocol: SIBICC_TIER_PROTOCOLS[recommendedTier],
    };
  }

  /**
   * Calculates Hyperosmolar Therapy Dosage.
   * Computes expected serum sodium shift and dosing for 20% Mannitol vs 3% Hypertonic Saline.
   */
  calculateHyperosmolarTherapy({ weightKg, serumSodium = 140, serumOsmolality = 290, targetSodium = 150, agentType = "HYPERTONIC_SALINE_3" }) {
    const totalBodyWater = weightKg * 0.6; // L

    if (agentType === "MANNITOL_20") {
      const standardDoseGrams = weightKg * 0.75; // 0.75 g/kg
      const volumeMl = standardDoseGrams * 5; // 20% solution = 20g/100mL = 5mL/g
      const maxRecommendedOsmolality = 320;
      const isSafeOsmolality = serumOsmolality < maxRecommendedOsmolality;

      return {
        agent: "Mannitol 20% IV Infusion",
        doseGrams: Number(standardDoseGrams.toFixed(1)),
        volumeMl: Number(volumeMl.toFixed(0)),
        infusionTimeMinutes: 20,
        osmolarGapWarning: !isSafeOsmolality,
        osmolarLimitMessage: isSafeOsmolality
          ? "Safe to administer. Current osmolality within permissible limit."
          : "CAUTION: Serum osmolality >= 320 mOsm/kg. Risk of acute kidney tubular necrosis; switch to hypertonic saline.",
      };
    } else {
      // 3% Hypertonic Saline (513 mEq Na/L)
      const sodiumDeficitMeq = totalBodyWater * (targetSodium - serumSodium);
      const bolusVolumeMl = 250; // Standard rescue bolus
      const expectedDeltaNa = Number((513 - serumSodium) / (totalBodyWater + 1) * (bolusVolumeMl / 1000)).toFixed(1);

      return {
        agent: "3% Hypertonic Saline (NaCl 513 mEq/L)",
        bolusVolumeMl,
        expectedDeltaNaMeqL: Number(expectedDeltaNa),
        targetSodiumMeqL: targetSodium,
        safetyCap: "Do not exceed serum sodium 155 mEq/L or delta Na > 10-12 mEq/L per 24h.",
      };
    }
  }

  /**
   * Serializes patient telemetry into HL7 FHIR R4 Bundle Observation resources.
   */
  exportHL7FHIRBundle(patientData, readingHistory = []) {
    const bundleId = `bundle-neuro-${patientData.id}-${Date.now()}`;
    const fhirObservations = readingHistory.map((item, index) => ({
      resourceType: "Observation",
      id: `obs-icp-${index}-${Date.now()}`,
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
          { system: "http://loinc.org", code: "60955-2", display: "Intracranial pressure" },
          { system: "http://loinc.org", code: "74780-8", display: "Cerebral perfusion pressure" },
          { system: "http://loinc.org", code: "85354-9", display: "Brain tissue oxygen tension" },
        ],
        text: "Multimodal Neuromonitoring Vital Signs",
      },
      subject: {
        reference: `Patient/${patientData.id}`,
        display: patientData.name,
      },
      effectiveDateTime: item.timestamp || new Date().toISOString(),
      component: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "60955-2", display: "ICP" }] },
          valueQuantity: { value: item.icp, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "74780-8", display: "CPP" }] },
          valueQuantity: { value: item.cpp, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "PbtO2" }] },
          valueQuantity: { value: item.pbtO2, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" },
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

export const neurocriticalCareService = new NeurocriticalCareService();
export default neurocriticalCareService;
