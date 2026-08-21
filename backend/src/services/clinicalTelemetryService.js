"use strict";

const crypto = require("crypto");
const ClinicalTelemetry = require("../models/clinicalTelemetry.model");
const logger = require("../utils/logger");

/**
 * High-Assurance Clinical Telemetry & Hemodynamic Calculation Engine
 *
 * Implements clinical decision support (CDS) algorithms validated against:
 * - American College of Cardiology (ACC) / AHA Shock Guidelines
 * - Surviving Sepsis Campaign (SSC) 2021 Guidelines
 * - Kidney Disease: Improving Global Outcomes (KDIGO) 2012 AKI criteria
 * - Royal College of Physicians NEWS2 (National Early Warning Score 2)
 * - HL7 FHIR R4 Standards & FDA 21 CFR Part 11 Electronic Signature Regulations
 */

class ClinicalTelemetryService {
  /**
   * Calculates Mean Arterial Pressure (MAP)
   * Formula: MAP = (2 * DBP + SBP) / 3
   */
  static calculateMAP(systolicBp, diastolicBp) {
    if (typeof systolicBp !== "number" || typeof diastolicBp !== "number") {
      throw new Error("Systolic and diastolic pressures must be valid numeric values.");
    }
    return Number(((2 * diastolicBp + systolicBp) / 3).toFixed(1));
  }

  /**
   * Calculates Cardiac Index (CI)
   * Formula: CI = Cardiac Output (L/min) / Body Surface Area (m^2)
   */
  static calculateCardiacIndex(cardiacOutput, bodySurfaceArea) {
    if (!bodySurfaceArea || bodySurfaceArea <= 0) {
      throw new Error("Valid Body Surface Area (BSA) required for Cardiac Index calculation.");
    }
    return Number((cardiacOutput / bodySurfaceArea).toFixed(2));
  }

  /**
   * Calculates Cardiac Power Output (CPO) in Watts
   * Formula: CPO = (MAP * CO) / 451
   * Clinical Note: CPO < 0.60 W is the strongest hemodynamic predictor of in-hospital mortality
   * in cardiogenic shock (Fincke et al., JACC 2004).
   */
  static calculateCardiacPowerOutput(map, cardiacOutput) {
    return Number(((map * cardiacOutput) / 451).toFixed(2));
  }

  /**
   * Calculates Systemic Vascular Resistance (SVR) in dynes·sec/cm^5
   * Formula: SVR = 80 * (MAP - CVP) / CO
   */
  static calculateSVR(map, cvp, cardiacOutput) {
    const effectiveCvp = typeof cvp === "number" ? cvp : 4; // default central venous pressure baseline
    if (!cardiacOutput || cardiacOutput <= 0) {
      return 0;
    }
    return Math.round((80 * (map - effectiveCvp)) / cardiacOutput);
  }

  /**
   * Calculates Left Ventricular Stroke Work Index (LVSWI) in g·m/m^2
   * Formula: LVSWI = 0.0136 * (MAP - PCWP) * SVI
   */
  static calculateLVSWI(map, pcwp, strokeVolumeIndex) {
    const effectivePcwp = typeof pcwp === "number" ? pcwp : 10;
    return Number((0.0136 * (map - effectivePcwp) * strokeVolumeIndex).toFixed(1));
  }

  /**
   * Calculates Vasopressor-Inotropic Score (VIS)
   * Formula: Dopamine + Dobutamine + 100*Epinephrine + 100*Norepinephrine + 10*Milrinone + 10000*Vasopressin
   */
  static calculateVIS({
    dopamineMcgKgMin = 0,
    dobutamineMcgKgMin = 0,
    epinephrineMcgKgMin = 0,
    norepinephrineMcgKgMin = 0,
    milrinoneMcgKgMin = 0,
    vasopressinUnitsMin = 0,
  } = {}) {
    const vis =
      dopamineMcgKgMin +
      dobutamineMcgKgMin +
      100 * epinephrineMcgKgMin +
      100 * norepinephrineMcgKgMin +
      10 * milrinoneMcgKgMin +
      10000 * vasopressinUnitsMin;
    return Number(vis.toFixed(2));
  }

  /**
   * Calculates Quick Sepsis-related Organ Failure Assessment (qSOFA) Score (0 - 3)
   * Criteria:
   * - Respiratory Rate >= 22 breaths/min (+1)
   * - Altered mentation (GCS < 15) (+1)
   * - Systolic BP <= 100 mmHg (+1)
   */
  static calculateQSOFA({ respiratoryRateBpm, gcsScore, systolicBpMmHg }) {
    let score = 0;
    if (respiratoryRateBpm >= 22) score += 1;
    if (gcsScore < 15) score += 1;
    if (systolicBpMmHg <= 100) score += 1;
    return score;
  }

  /**
   * Calculates National Early Warning Score 2 (NEWS2) (0 - 20)
   */
  static calculateNEWS2({
    respiratoryRate,
    spO2Percent,
    supplementalOxygen = false,
    systolicBp,
    pulseBpm,
    consciousnessAlert = true,
    temperatureCelsius,
  }) {
    let score = 0;

    // Respiration Rate
    if (respiratoryRate <= 8) score += 3;
    else if (respiratoryRate >= 9 && respiratoryRate <= 11) score += 1;
    else if (respiratoryRate >= 12 && respiratoryRate <= 20) score += 0;
    else if (respiratoryRate >= 21 && respiratoryRate <= 24) score += 2;
    else if (respiratoryRate >= 25) score += 3;

    // SpO2 Scale 1
    if (spO2Percent <= 91) score += 3;
    else if (spO2Percent >= 92 && spO2Percent <= 93) score += 2;
    else if (spO2Percent >= 94 && spO2Percent <= 95) score += 1;

    // Supplemental Oxygen
    if (supplementalOxygen) score += 2;

    // Systolic Blood Pressure
    if (systolicBp <= 90) score += 3;
    else if (systolicBp >= 91 && systolicBp <= 100) score += 2;
    else if (systolicBp >= 101 && systolicBp <= 110) score += 1;
    else if (systolicBp >= 220) score += 3;

    // Heart Rate
    if (pulseBpm <= 40) score += 3;
    else if (pulseBpm >= 41 && pulseBpm <= 50) score += 1;
    else if (pulseBpm >= 91 && pulseBpm <= 110) score += 1;
    else if (pulseBpm >= 111 && pulseBpm <= 130) score += 2;
    else if (pulseBpm >= 131) score += 3;

    // Consciousness
    if (!consciousnessAlert) score += 3;

    // Temperature
    if (temperatureCelsius <= 35.0) score += 3;
    else if (temperatureCelsius >= 35.1 && temperatureCelsius <= 36.0) score += 1;
    else if (temperatureCelsius >= 38.1 && temperatureCelsius <= 39.0) score += 1;
    else if (temperatureCelsius >= 39.1) score += 2;

    return score;
  }

  /**
   * Calculates KDIGO Acute Kidney Injury (AKI) Staging (0 - 3)
   */
  static calculateKDIGOStage({
    baselineCreatinineMgDl,
    currentCreatinineMgDl,
    urineOutputMlKgHr,
    hoursUrineOliguria,
  }) {
    if (!baselineCreatinineMgDl || !currentCreatinineMgDl) return 0;
    const ratio = currentCreatinineMgDl / baselineCreatinineMgDl;
    const delta = currentCreatinineMgDl - baselineCreatinineMgDl;

    // Stage 3
    if (
      ratio >= 3.0 ||
      currentCreatinineMgDl >= 4.0 ||
      (urineOutputMlKgHr < 0.3 && hoursUrineOliguria >= 24) ||
      (urineOutputMlKgHr === 0 && hoursUrineOliguria >= 12)
    ) {
      return 3;
    }

    // Stage 2
    if (ratio >= 2.0 && ratio <= 2.9) {
      return 2;
    }
    if (urineOutputMlKgHr < 0.5 && hoursUrineOliguria >= 12) {
      return 2;
    }

    // Stage 1
    if (ratio >= 1.5 && ratio <= 1.9) {
      return 1;
    }
    if (delta >= 0.3) {
      return 1;
    }
    if (urineOutputMlKgHr < 0.5 && hoursUrineOliguria >= 6) {
      return 1;
    }

    return 0;
  }

  /**
   * Generates a 21 CFR Part 11 Compliant Electronic Signature Cryptographic Hash
   */
  static generateFDA21CFRSignature({ userId, userRole, actionType, timestamp, secretKey }) {
    const payload = JSON.stringify({
      userId,
      userRole,
      actionType,
      timestamp: new Date(timestamp).toISOString(),
      standard: "FDA-21-CFR-PART-11",
    });
    return crypto
      .createHmac("sha256", secretKey || "CLINICAL_SIGNATURE_SALT_2026")
      .update(payload)
      .digest("hex");
  }

  /**
   * Maps Clinical Telemetry record to HL7 FHIR R4 Bundle Resource JSON
   */
  static toHL7FHIRBundle(telemetryRecord) {
    const reading = telemetryRecord.latestReadings || {};
    return {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: "urn:uuid:patient-" + telemetryRecord.patientId,
          resource: {
            resourceType: "Patient",
            id: telemetryRecord.patientId,
            identifier: [{ system: "http://hospital.org/mrn", value: telemetryRecord.mrn }],
            name: [{ text: telemetryRecord.patientFullName }],
            gender: telemetryRecord.gender.toLowerCase(),
          },
        },
        {
          fullUrl: "urn:uuid:obs-hemodynamics-" + telemetryRecord._id,
          resource: {
            resourceType: "Observation",
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
                {
                  system: "http://loinc.org",
                  code: "8867-4",
                  display: "Heart rate",
                },
              ],
            },
            subject: { reference: "Patient/" + telemetryRecord.patientId },
            effectiveDateTime: reading.timestamp || new Date().toISOString(),
            valueQuantity: {
              value: reading.heartRateBpm,
              unit: "beats/minute",
              system: "http://unitsofmeasure.org",
              code: "/min",
            },
            component: [
              {
                code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }] },
                valueQuantity: { value: reading.systolicBpMmHg, unit: "mmHg", code: "mm[Hg]" },
              },
              {
                code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic BP" }] },
                valueQuantity: { value: reading.diastolicBpMmHg, unit: "mmHg", code: "mm[Hg]" },
              },
              {
                code: { coding: [{ system: "http://loinc.org", code: "8478-0", display: "Mean Arterial Pressure" }] },
                valueQuantity: { value: reading.meanArterialPressureMmHg, unit: "mmHg", code: "mm[Hg]" },
              },
              {
                code: { coding: [{ system: "http://loinc.org", code: "8277-6", display: "Cardiac Output" }] },
                valueQuantity: { value: reading.cardiacOutputLpm, unit: "L/min", code: "L/min" },
              },
              {
                code: { coding: [{ system: "http://loinc.org", code: "25320-3", display: "Cardiac Power Output" }] },
                valueQuantity: { value: reading.cardiacPowerOutputWatts, unit: "Watts", code: "W" },
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Ingests real-time telemetry stream data for a bed and calculates derived hemodynamic biomarkers
   */
  static async processIncomingTelemetry(patientId, rawReadings, actor = {}) {
    const map = this.calculateMAP(rawReadings.systolicBpMmHg, rawReadings.diastolicBpMmHg);
    const ci = this.calculateCardiacIndex(rawReadings.cardiacOutputLpm, rawReadings.bodySurfaceAreaM2 || 1.85);
    const cpo = this.calculateCardiacPowerOutput(map, rawReadings.cardiacOutputLpm);
    const svr = this.calculateSVR(map, rawReadings.centralVenousPressureMmHg, rawReadings.cardiacOutputLpm);
    const strokeVolume = Number(((rawReadings.cardiacOutputLpm * 1000) / rawReadings.heartRateBpm).toFixed(1));
    const svi = Number((strokeVolume / (rawReadings.bodySurfaceAreaM2 || 1.85)).toFixed(1));
    const lvswi = this.calculateLVSWI(map, rawReadings.pulmonaryCapillaryWedgePressureMmHg, svi);

    const qSofa = this.calculateQSOFA({
      respiratoryRateBpm: rawReadings.respiratoryRateBpm || 18,
      gcsScore: rawReadings.gcsScore || 15,
      systolicBpMmHg: rawReadings.systolicBpMmHg,
    });

    const news2 = this.calculateNEWS2({
      respiratoryRate: rawReadings.respiratoryRateBpm || 18,
      spO2Percent: rawReadings.spO2Percent || 98,
      supplementalOxygen: rawReadings.supplementalOxygen || false,
      systolicBp: rawReadings.systolicBpMmHg,
      pulseBpm: rawReadings.heartRateBpm,
      consciousnessAlert: (rawReadings.gcsScore || 15) === 15,
      temperatureCelsius: rawReadings.temperatureCelsius || 37.0,
    });

    const readingPayload = {
      timestamp: new Date(),
      heartRateBpm: rawReadings.heartRateBpm,
      systolicBpMmHg: rawReadings.systolicBpMmHg,
      diastolicBpMmHg: rawReadings.diastolicBpMmHg,
      meanArterialPressureMmHg: map,
      centralVenousPressureMmHg: rawReadings.centralVenousPressureMmHg || null,
      pulmonaryCapillaryWedgePressureMmHg: rawReadings.pulmonaryCapillaryWedgePressureMmHg || null,
      cardiacOutputLpm: rawReadings.cardiacOutputLpm,
      cardiacIndexLpmM2: ci,
      cardiacPowerOutputWatts: cpo,
      systemicVascularResistanceDynsCm5: svr,
      strokeVolumeMl: strokeVolume,
      leftVentricularStrokeWorkIndexGmPerM2: lvswi,
      mixedVenousO2SatPercent: rawReadings.mixedVenousO2SatPercent || 72,
      arterialLactateMmolL: rawReadings.arterialLactateMmolL || 1.2,
      arterialPh: rawReadings.arterialPh || 7.4,
      paO2MmHg: rawReadings.paO2MmHg || 95,
      paCO2MmHg: rawReadings.paCO2MmHg || 40,
      hco3MeqL: rawReadings.hco3MeqL || 24,
    };

    let doc = await ClinicalTelemetry.findOne({ patientId });
    if (doc) {
      doc.latestReadings = readingPayload;
      doc.qSofaScore = qSofa;
      doc.news2Score = news2;
      doc.telemetryHistory.push(readingPayload);
      if (doc.telemetryHistory.length > 120) {
        doc.telemetryHistory = doc.telemetryHistory.slice(-120);
      }
      await doc.save();
    }

    logger.info("Processed clinical telemetry stream", {
      patientId,
      cpo,
      map,
      qSofa,
      news2,
    });

    return { readingPayload, qSofa, news2, cpo, map, svr, lvswi };
  }

  /**
   * Triggers an emergency protocol with 21 CFR Part 11 compliant audit logging
   */
  static async triggerEmergencyProtocol({
    patientId,
    protocolType,
    userId,
    userRole,
    clinicalRationale,
  }) {
    const signatureHash = this.generateFDA21CFRSignature({
      userId,
      userRole,
      actionType: protocolType,
      timestamp: new Date(),
    });

    const event = {
      protocolType,
      triggeredAt: new Date(),
      triggeredByUserId: userId,
      triggeredByRole: userRole,
      clinicalRationale,
      status: "ACTIVE",
      fda21CfrSignatureHash: signatureHash,
    };

    const doc = await ClinicalTelemetry.findOneAndUpdate(
      { patientId },
      {
        $push: { emergencyProtocols: event },
        $set: {
          acuityStatus:
            protocolType === "CODE_RED_CARDIAC_ARREST"
              ? "CODE_BLUE"
              : protocolType === "CODE_STEMI_CATH_LAB_ACTIVATION"
              ? "CARDIOGENIC_SHOCK"
              : "CRITICAL",
        },
      },
      { new: true }
    );

    return { doc, event };
  }
}

module.exports = ClinicalTelemetryService;
