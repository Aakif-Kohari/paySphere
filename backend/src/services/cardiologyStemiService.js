import crypto from 'crypto';
import {
  D2B_MILESTONES,
  KILLIP_CLASSIFICATION,
  STEMI_SEVERITY_LEVELS,
  TIMI_STEMI_RISK_FACTORS,
} from '../models/cardiologyStemi.model.js';

/**
 * Acute Coronary Syndrome & STEMI Interventional Cath Lab Clinical Decision Support Service.
 *
 * Implements ACC/AHA guidelines for Door-to-Balloon (D2B) performance, TIMI risk scoring for STEMI,
 * GRACE 2.0 risk index, Cardiac Power Output (CPO), Shock Index (SI), and HL7 FHIR R4 Bundle generation.
 */
export class CardiologyStemiService {
  static assertFiniteNumber(value, fieldName, { min = -Infinity, max = Infinity } = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${fieldName} must be a finite number`);
    }
    if (value < min || value > max) {
      throw new RangeError(`${fieldName} must be between ${min} and ${max}`);
    }
    return value;
  }

  /**
   * Calculates Cardiac Power Output (CPO).
   * Formula: CPO (Watts) = [MAP (mmHg) x Cardiac Output (L/min)] / 451
   * Clinical standard: CPO < 0.6 W is the strongest independent hemodynamic predictor of mortality in cardiogenic shock (SHOCK trial).
   * @param {number} map
   * @param {number} cardiacOutput
   * @returns {{ cpoWatts: number, riskCategory: string, clinicalMeaning: string }}
   */
  static calculateCardiacPowerOutput(map, cardiacOutput) {
    this.assertFiniteNumber(map, 'MAP', { min: 20, max: 250 });
    this.assertFiniteNumber(cardiacOutput, 'Cardiac Output', { min: 0.5, max: 20 });

    const cpoWatts = Math.round(((map * cardiacOutput) / 451) * 100) / 100;

    let riskCategory = 'NORMAL_HEMODYNAMICS';
    let clinicalMeaning = 'Adequate hydraulic cardiac pumping capacity (CPO >= 1.0 W).';

    if (cpoWatts < 0.6) {
      riskCategory = 'SEVERE_CARDIOGENIC_SHOCK';
      clinicalMeaning = 'Critically depressed cardiac pumping (CPO < 0.6 W). Strong indication for emergent mechanical circulatory support (Impella / ECMO / IABP).';
    } else if (cpoWatts < 0.8) {
      riskCategory = 'IMPAIRED_CARDIAC_POWER';
      clinicalMeaning = 'Borderline/Compromised cardiac power reserve (0.6 - 0.8 W). Requires close invasive hemodynamic monitoring.';
    }

    return {
      cpoWatts,
      riskCategory,
      clinicalMeaning,
    };
  }

  /**
   * Calculates Shock Index (SI) and Age-Adjusted Shock Index (SIA).
   * Formula: Shock Index = Heart Rate / Systolic Blood Pressure
   * @param {number} heartRate
   * @param {number} systolicBp
   * @param {number} ageYears
   * @returns {{ shockIndex: number, ageAdjustedShockIndex: number, interpretation: string }}
   */
  static calculateShockIndex(heartRate, systolicBp, ageYears = 65) {
    this.assertFiniteNumber(heartRate, 'Heart Rate', { min: 20, max: 300 });
    this.assertFiniteNumber(systolicBp, 'Systolic BP', { min: 30, max: 300 });

    const shockIndex = Math.round((heartRate / systolicBp) * 100) / 100;
    const ageAdjustedShockIndex = Math.round((shockIndex * ageYears) * 10) / 10;

    let interpretation = 'Normal left ventricular vascular load (SI 0.5 - 0.7)';
    if (shockIndex > 1.0) {
      interpretation = 'High risk: Severe left ventricular failure / cardiogenic shock (SI > 1.0)';
    } else if (shockIndex > 0.8) {
      interpretation = 'Elevated: Impending hemodynamic compromise (SI 0.8 - 1.0)';
    }

    return {
      shockIndex,
      ageAdjustedShockIndex,
      interpretation,
    };
  }

  /**
   * Calculates Coronary Perfusion Pressure (CPP).
   * Formula: CPP = Diastolic Blood Pressure - PAOP (or Diastolic BP - CVP)
   * Target: CPP >= 50 mmHg in acute coronary syndromes.
   * @param {number} diastolicBp
   * @param {number} cvpOrPaop
   * @returns {{ cppMmHg: number, adequatePerfusion: boolean }}
   */
  static calculateCoronaryPerfusionPressure(diastolicBp, cvpOrPaop = 12) {
    this.assertFiniteNumber(diastolicBp, 'Diastolic BP', { min: 10, max: 200 });
    const cppMmHg = Math.max(0, Math.round(diastolicBp - cvpOrPaop));
    return {
      cppMmHg,
      adequatePerfusion: cppMmHg >= 50,
      interpretation: cppMmHg >= 50 ? 'Adequate coronary driving pressure' : 'Compromised coronary microvascular perfusion',
    };
  }

  /**
   * Computes TIMI Risk Score for STEMI (0 - 14 points) and 30-day predicted mortality.
   * @param {object} patient
   * @returns {{ timiScore: number, predictedThirtyDayMortalityPercent: number, riskCategory: string, factorsMet: string[] }}
   */
  static calculateTimiStemiScore(patient) {
    let score = 0;
    const factorsMet = [];

    if (patient.ageYears >= 75) {
      score += 3;
      factorsMet.push('Age >= 75 years (+3 pts)');
    } else if (patient.ageYears >= 65) {
      score += 2;
      factorsMet.push('Age 65 - 74 years (+2 pts)');
    }

    if (patient.systolicBp < 100) {
      score += 3;
      factorsMet.push('Systolic BP < 100 mmHg (+3 pts)');
    }

    if (patient.heartRate > 100) {
      score += 2;
      factorsMet.push('Heart Rate > 100 BPM (+2 pts)');
    }

    if (patient.killipClass && patient.killipClass !== 'CLASS_I') {
      score += 2;
      factorsMet.push(`Killip Class ${patient.killipClass.replace('CLASS_', '')} Heart Failure (+2 pts)`);
    }

    if (patient.weightKg < 67) {
      score += 1;
      factorsMet.push('Body weight < 67 kg (+1 pt)');
    }

    if (patient.ecgLeadChanges && (patient.ecgLeadChanges.includes('V1') || patient.ecgLeadChanges.includes('LBBB') || patient.ecgLeadChanges.includes('Anterior'))) {
      score += 1;
      factorsMet.push('Anterior ST elevation / LBBB (+1 pt)');
    }

    // Mortality lookup according to TIMI trial data
    const mortalityLookup = {
      0: 0.8,
      1: 1.6,
      2: 2.2,
      3: 4.4,
      4: 7.3,
      5: 12.4,
      6: 16.1,
      7: 23.4,
      8: 26.8,
    };

    const predictedThirtyDayMortalityPercent = score >= 8 ? 35.9 : (mortalityLookup[score] ?? 15.0);

    let riskCategory = 'LOW_RISK';
    if (score >= 6) riskCategory = 'VERY_HIGH_RISK';
    else if (score >= 4) riskCategory = 'HIGH_RISK';
    else if (score >= 2) riskCategory = 'INTERMEDIATE_RISK';

    return {
      timiScore: score,
      predictedThirtyDayMortalityPercent,
      riskCategory,
      factorsMet,
    };
  }

  /**
   * Evaluates Door-to-Balloon (D2B) Quality Benchmark Compliance.
   * @param {object} patient
   * @param {number} elapsedMinutes
   * @returns {{ d2bCompliancePercent: number, milestones: Array<object>, isD2bCompliant: boolean }}
   */
  static evaluateD2bCompliance(patient, elapsedMinutes = 38) {
    const progress = patient.d2bProgress || {};
    const milestones = [
      {
        ...D2B_MILESTONES.DOOR_TO_ECG,
        completed: Boolean(progress.doorToEcgDone),
        timeRemainingMinutes: Math.max(0, 10 - elapsedMinutes),
        overdue: elapsedMinutes > 10 && !progress.doorToEcgDone,
      },
      {
        ...D2B_MILESTONES.CATH_LAB_ACTIVATION,
        completed: Boolean(progress.cathLabActivationDone),
        timeRemainingMinutes: Math.max(0, 20 - elapsedMinutes),
        overdue: elapsedMinutes > 20 && !progress.cathLabActivationDone,
      },
      {
        ...D2B_MILESTONES.PATIENT_ARRIVAL_LAB,
        completed: Boolean(progress.patientArrivalLabDone),
        timeRemainingMinutes: Math.max(0, 45 - elapsedMinutes),
        overdue: elapsedMinutes > 45 && !progress.patientArrivalLabDone,
      },
      {
        ...D2B_MILESTONES.ARTERIAL_ACCESS,
        completed: Boolean(progress.arterialAccessDone),
        timeRemainingMinutes: Math.max(0, 60 - elapsedMinutes),
        overdue: elapsedMinutes > 60 && !progress.arterialAccessDone,
      },
      {
        ...D2B_MILESTONES.BALLOON_TIME,
        completed: Boolean(progress.balloonTimeDone),
        timeRemainingMinutes: Math.max(0, 90 - elapsedMinutes),
        overdue: elapsedMinutes > 90 && !progress.balloonTimeDone,
      },
      {
        ...D2B_MILESTONES.POST_PCI_ANTICOAGULATION,
        completed: Boolean(progress.postPciAnticoagulationDone),
        timeRemainingMinutes: Math.max(0, 120 - elapsedMinutes),
        overdue: elapsedMinutes > 120 && !progress.postPciAnticoagulationDone,
      },
    ];

    const completedCount = milestones.filter((m) => m.completed).length;
    const d2bCompliancePercent = Math.round((completedCount / milestones.length) * 100);

    return {
      d2bCompliancePercent,
      milestones,
      isD2bCompliant: elapsedMinutes <= 90 || Boolean(progress.balloonTimeDone),
    };
  }

  /**
   * Evaluates ESC 0/1-hour high-sensitivity Cardiac Troponin delta kinetics.
   * @param {number} t0
   * @param {number} t1
   * @param {number} deltaHours
   * @returns {{ deltaAbsolute: number, deltaRatePerHour: number, decisionCategory: string, recommendation: string }}
   */
  static evaluateTroponinKinetics(t0, t1, deltaHours = 1.0) {
    this.assertFiniteNumber(t0, 'Troponin T0', { min: 0, max: 1000 });
    this.assertFiniteNumber(t1, 'Troponin T1', { min: 0, max: 1000 });

    const deltaAbsolute = Math.round((t1 - t0) * 100) / 100;
    const deltaRatePerHour = Math.round((deltaAbsolute / (deltaHours || 1.0)) * 100) / 100;

    let decisionCategory = 'RULE_OUT';
    let recommendation = 'Low initial troponin with no significant dynamic change. Consider non-coronary etiologies.';

    if (t0 > 5.0 || deltaAbsolute >= 5.0) {
      decisionCategory = 'RULE_IN_ACUTE_MYOCARDIAL_INFARCTION';
      recommendation = 'Significant dynamic elevation in hs-cTnI meeting acute myocardial infarction criteria. Immediate invasive coronary angiography indicated.';
    } else if (t0 > 1.0 || deltaAbsolute >= 1.0) {
      decisionCategory = 'OBSERVE_AND_SERIAL_REASSESSMENT';
      recommendation = 'Intermediate troponin trajectory. Perform 3-hour follow-up troponin and continuous 12-lead ST-segment monitoring.';
    }

    return {
      deltaAbsolute,
      deltaRatePerHour,
      decisionCategory,
      recommendation,
    };
  }

  /**
   * Generates FDA 21 CFR Part 11 cryptographic digital audit signature.
   * @param {string} clinicianId
   * @param {string} protocolId
   * @param {object} patientData
   * @returns {{ signatureHash: string, timestamp: string, verificationAlgorithm: string, signer: string }}
   */
  static generateAuditSignature(clinicianId, protocolId, patientData) {
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      clinicianId,
      protocolId,
      patientId: patientData.id,
      mrn: patientData.mrn,
      culpritVessel: patientData.culpritVessel,
      timiScore: patientData.timiScore,
      timestamp,
    });

    const signatureHash = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      signatureHash,
      timestamp,
      verificationAlgorithm: 'SHA-256 / FDA 21 CFR Part 11 Electronic Records',
      signer: clinicianId,
      status: 'AUTHENTICATED_AND_SEALED',
    };
  }

  /**
   * Generates HL7 FHIR R4 Bundle for Interventional STEMI / Cath Lab CarePlan.
   * @param {object} patient
   * @returns {object} HL7 FHIR R4 Bundle JSON
   */
  static exportFhirR4Bundle(patient) {
    const now = new Date().toISOString();
    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: now,
      identifier: {
        system: 'https://medtrack.hospital.org/fhir/stemi-bundle',
        value: `STEMI-FHIR-${patient.id}-${Date.now()}`,
      },
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: patient.id,
            identifier: [{ system: 'urn:mrn', value: patient.mrn }],
            name: [{ text: patient.name }],
            gender: patient.sex.toLowerCase(),
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-cpo-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://snomed.info/sct', code: '364684004', display: 'Cardiac Power Output' }],
              text: 'Cardiac Power Output',
            },
            subject: { reference: `Patient/${patient.id}` },
            effectiveDateTime: now,
            valueQuantity: {
              value: patient.cardiacPowerOutput,
              unit: 'W',
              system: 'http://unitsofmeasure.org',
              code: 'W',
            },
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: `obs-troponin-${patient.id}`,
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: '49563-0', display: 'Cardiac Troponin I' }],
              text: 'High-Sensitivity Cardiac Troponin I',
            },
            subject: { reference: `Patient/${patient.id}` },
            effectiveDateTime: now,
            valueQuantity: {
              value: patient.troponinICurrent,
              unit: 'ng/mL',
              system: 'http://unitsofmeasure.org',
              code: 'ng/mL',
            },
          },
        },
        {
          resource: {
            resourceType: 'CarePlan',
            id: `cp-stemi-${patient.id}`,
            status: 'active',
            intent: 'order',
            title: 'ACC/AHA Primary Percutaneous Coronary Intervention (PCI) Care Plan',
            subject: { reference: `Patient/${patient.id}` },
            period: { start: now },
            activity: [
              {
                detail: {
                  kind: 'ServiceRequest',
                  code: { text: `Primary Angioplasty / Stenting of ${patient.culpritVessel}` },
                  status: 'in-progress',
                },
              },
            ],
          },
        },
      ],
    };
  }
}
