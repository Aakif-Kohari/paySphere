import crypto from 'crypto';
import {
  HEMORRHAGE_THRESHOLDS,
  NEWS2_THRESHOLDS,
  PROTOCOL_DEFINITIONS,
  START_THRESHOLDS,
  TRIAGE_CATEGORIES,
} from '../models/emergencyTriage.model.js';

/**
 * Emergency Triage Clinical Decision Support Engine.
 *
 * Pure, deterministic calculations are used wherever possible so every result
 * can be reproduced during clinical review. The service never replaces bedside
 * assessment and deliberately returns its rationale with every classification.
 */
export class EmergencyTriageService {
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
   * Adult START triage using respiration, perfusion and mental status.
   */
  static classifyStart(patient) {
    const rationale = [];
    const threshold = START_THRESHOLDS.adult;

    if (patient.ambulatory) {
      rationale.push('Patient can walk to the designated treatment area.');
      return this.buildTriageResult('MINOR', rationale, 'Reassess after all non-ambulatory patients.');
    }

    if (!patient.spontaneousBreathing) {
      if (!patient.spontaneousBreathingAfterAirwayReposition) {
        rationale.push('No spontaneous respirations after airway repositioning.');
        return this.buildTriageResult(
          'EXPECTANT',
          rationale,
          'Follow incident command and jurisdiction-specific expectant-care policy.',
        );
      }

      rationale.push('Respirations resumed only after airway repositioning.');
      return this.buildTriageResult('IMMEDIATE', rationale, 'Maintain airway and move to immediate treatment.');
    }

    if (patient.respiratoryRate > threshold.respiratoryRateHigh) {
      rationale.push(`Respiratory rate ${patient.respiratoryRate}/min exceeds ${threshold.respiratoryRateHigh}/min.`);
      return this.buildTriageResult('IMMEDIATE', rationale, 'Immediate airway and breathing assessment.');
    }

    const perfusionFailed =
      patient.radialPulsePresent === false ||
      patient.pulsePresent === false ||
      patient.capillaryRefillSeconds > threshold.capillaryRefillSecondsHigh;

    if (perfusionFailed) {
      rationale.push(
        patient.radialPulsePresent === false || patient.pulsePresent === false
          ? 'Peripheral pulse is absent.'
          : `Capillary refill is ${patient.capillaryRefillSeconds}s, above the ${threshold.capillaryRefillSecondsHigh}s threshold.`,
      );
      return this.buildTriageResult('IMMEDIATE', rationale, 'Control bleeding and treat shock immediately.');
    }

    if (!patient.followsCommands) {
      rationale.push('Patient cannot follow simple commands.');
      return this.buildTriageResult('IMMEDIATE', rationale, 'Protect airway and assess neurologic injury.');
    }

    rationale.push('Respiration, perfusion and command-following criteria do not meet immediate thresholds.');
    return this.buildTriageResult('DELAYED', rationale, 'Move to delayed treatment with serial reassessment.');
  }

  /**
   * Pediatric JumpSTART triage. Apneic children with a pulse receive five rescue
   * breaths before classification; this branch is explicitly represented in the
   * input to avoid suggesting the software itself performed an intervention.
   */
  static classifyJumpStart(patient) {
    const rationale = [];
    const threshold = START_THRESHOLDS.pediatric;

    if (patient.ambulatory) {
      rationale.push('Child is ambulatory and can reach the designated treatment area.');
      return this.buildTriageResult('MINOR', rationale, 'Perform pediatric secondary triage.');
    }

    if (!patient.spontaneousBreathing) {
      if (!patient.pulsePresent) {
        rationale.push('Apnea with no palpable pulse.');
        return this.buildTriageResult('EXPECTANT', rationale, 'Follow local pediatric MCI policy.');
      }
      if (!patient.spontaneousBreathingAfterRescueBreaths) {
        rationale.push(`Apnea persists after ${threshold.rescueBreaths} documented rescue breaths.`);
        return this.buildTriageResult('EXPECTANT', rationale, 'Follow local pediatric MCI policy.');
      }
      rationale.push(`Breathing resumed after ${threshold.rescueBreaths} rescue breaths.`);
      return this.buildTriageResult('IMMEDIATE', rationale, 'Maintain airway and evacuate immediately.');
    }

    if (
      patient.respiratoryRate < threshold.respiratoryRateLow ||
      patient.respiratoryRate > threshold.respiratoryRateHigh
    ) {
      rationale.push(
        `Respiratory rate ${patient.respiratoryRate}/min is outside the ` +
          `${threshold.respiratoryRateLow}-${threshold.respiratoryRateHigh}/min band.`,
      );
      return this.buildTriageResult('IMMEDIATE', rationale, 'Immediate pediatric respiratory assessment.');
    }

    if (!patient.pulsePresent) {
      rationale.push('No palpable pulse despite spontaneous breathing.');
      return this.buildTriageResult('IMMEDIATE', rationale, 'Treat shock and verify central pulse.');
    }

    if (threshold.avpuMentalStatusImmediate.includes(patient.mentalStatus)) {
      rationale.push(`AVPU mental status ${patient.mentalStatus} meets immediate criteria.`);
      return this.buildTriageResult('IMMEDIATE', rationale, 'Protect airway and assess neurologic injury.');
    }

    rationale.push('JumpSTART respiration, pulse and mental-status checks are within delayed criteria.');
    return this.buildTriageResult('DELAYED', rationale, 'Move to delayed pediatric treatment area.');
  }

  static buildTriageResult(categoryId, rationale, immediateAction) {
    const category = TRIAGE_CATEGORIES[categoryId];
    return {
      algorithm: 'START_JUMPSTART',
      category: category.id,
      label: category.label,
      priority: category.priority,
      disposition: category.disposition,
      rationale,
      immediateAction,
      reassessmentRequired: true,
    };
  }

  /** Royal College of Physicians NEWS2 Scale 1 calculation. */
  static calculateNews2(observation) {
    const breakdown = {
      respiratoryRate: this.scoreNewsRespiratoryRate(observation.respiratoryRate),
      oxygenSaturation: this.scoreNewsSpO2ScaleOne(observation.spo2),
      supplementalOxygen: observation.supplementalOxygen ? 2 : 0,
      systolicPressure: this.scoreNewsSystolicPressure(observation.systolicBp),
      pulse: this.scoreNewsPulse(observation.heartRate),
      consciousness: observation.mentalStatus === 'A' ? 0 : 3,
      temperature: this.scoreNewsTemperature(observation.temperatureC),
    };
    const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const anySingleThree = Object.values(breakdown).some((score) => score === 3);

    let risk = 'LOW';
    let response = NEWS2_THRESHOLDS.low.response;
    if (total >= NEWS2_THRESHOLDS.high.min) {
      risk = 'HIGH';
      response = NEWS2_THRESHOLDS.high.response;
    } else if (total >= NEWS2_THRESHOLDS.medium.min) {
      risk = 'MEDIUM';
      response = NEWS2_THRESHOLDS.medium.response;
    } else if (anySingleThree) {
      risk = 'LOW_SINGLE_PARAMETER_3';
      response = NEWS2_THRESHOLDS.lowSingleThree.response;
    }

    return { total, risk, response, breakdown, scale: 'NEWS2_SCALE_1' };
  }

  static scoreNewsRespiratoryRate(value) {
    this.assertFiniteNumber(value, 'respiratoryRate', { min: 0, max: 100 });
    if (value <= 8 || value >= 25) return 3;
    if (value >= 21) return 2;
    if (value <= 11) return 1;
    return 0;
  }

  static scoreNewsSpO2ScaleOne(value) {
    this.assertFiniteNumber(value, 'spo2', { min: 0, max: 100 });
    if (value <= 91) return 3;
    if (value <= 93) return 2;
    if (value <= 95) return 1;
    return 0;
  }

  static scoreNewsSystolicPressure(value) {
    this.assertFiniteNumber(value, 'systolicBp', { min: 0, max: 350 });
    if (value <= 90 || value >= 220) return 3;
    if (value <= 100) return 2;
    if (value <= 110) return 1;
    return 0;
  }

  static scoreNewsPulse(value) {
    this.assertFiniteNumber(value, 'heartRate', { min: 0, max: 300 });
    if (value <= 40 || value >= 131) return 3;
    if (value >= 111) return 2;
    if (value <= 50 || value >= 91) return 1;
    return 0;
  }

  static scoreNewsTemperature(value) {
    this.assertFiniteNumber(value, 'temperatureC', { min: 20, max: 45 });
    if (value <= 35) return 3;
    if (value >= 39.1) return 2;
    if (value <= 36 || value >= 38.1) return 1;
    return 0;
  }

  /** qSOFA is a risk prompt, not a stand-alone sepsis diagnosis. */
  static calculateQsofa({ respiratoryRate, systolicBp, gcs, alteredMentation }) {
    const criteria = {
      respiratoryRateAtLeast22: respiratoryRate >= 22,
      systolicPressureAtMost100: systolicBp <= 100,
      alteredMentation: alteredMentation ?? gcs < 15,
    };
    const score = Object.values(criteria).filter(Boolean).length;
    return {
      score,
      criteria,
      elevatedRiskPrompt: score >= 2,
      interpretation:
        score >= 2
          ? 'Elevated risk prompt: evaluate for organ dysfunction and sepsis without delaying treatment.'
          : 'qSOFA below two does not exclude sepsis; continue clinical assessment.',
    };
  }

  static calculateShockIndex({ heartRate, systolicBp, map }) {
    this.assertFiniteNumber(heartRate, 'heartRate', { min: 0, max: 300 });
    this.assertFiniteNumber(systolicBp, 'systolicBp', { min: 1, max: 350 });
    this.assertFiniteNumber(map, 'map', { min: 1, max: 250 });

    const shockIndex = Number((heartRate / systolicBp).toFixed(2));
    const modifiedShockIndex = Number((heartRate / map).toFixed(2));
    let severity = 'REASSURING';
    if (shockIndex >= HEMORRHAGE_THRESHOLDS.shockIndexCritical) severity = 'CRITICAL';
    else if (
      shockIndex >= HEMORRHAGE_THRESHOLDS.shockIndexWarning ||
      modifiedShockIndex >= HEMORRHAGE_THRESHOLDS.modifiedShockIndexWarning
    ) {
      severity = 'ELEVATED';
    }

    return {
      shockIndex,
      modifiedShockIndex,
      severity,
      interpretation:
        severity === 'REASSURING'
          ? 'Indices do not meet configured escalation thresholds.'
          : 'Possible circulatory compromise; correlate with examination, injury pattern and serial trends.',
    };
  }

  static calculateLactateClearance({ initialLactate, repeatLactate, elapsedHours }) {
    this.assertFiniteNumber(initialLactate, 'initialLactate', { min: 0.1, max: 40 });
    this.assertFiniteNumber(repeatLactate, 'repeatLactate', { min: 0, max: 40 });
    this.assertFiniteNumber(elapsedHours, 'elapsedHours', { min: 0.1, max: 72 });
    const clearancePercent = Number((((initialLactate - repeatLactate) / initialLactate) * 100).toFixed(1));
    const perHourPercent = Number((clearancePercent / elapsedHours).toFixed(1));
    return {
      clearancePercent,
      perHourPercent,
      trend: clearancePercent >= 10 ? 'IMPROVING' : clearancePercent >= 0 ? 'LIMITED_CLEARANCE' : 'WORSENING',
      caveat: 'Interpret serial lactate in clinical context; impaired clearance and non-hypoperfusion causes may contribute.',
    };
  }

  static assessHemorrhageRisk(patient) {
    const shock = this.calculateShockIndex(patient);
    const criteria = {
      criticalShockIndex: shock.shockIndex >= HEMORRHAGE_THRESHOLDS.shockIndexCritical,
      hypotension: patient.systolicBp < HEMORRHAGE_THRESHOLDS.systolicPressureCriticalMmHg,
      criticalLactate: patient.lactate >= HEMORRHAGE_THRESHOLDS.lactateCriticalMmolL,
      criticalBaseDeficit: patient.baseDeficit <= HEMORRHAGE_THRESHOLDS.baseDeficitCritical,
      estimatedMajorBloodLoss:
        patient.estimatedBloodLossMl >= HEMORRHAGE_THRESHOLDS.estimatedBloodLossCriticalMl,
      rapidTransfusion:
        patient.unitsRbcLastFourHours >= HEMORRHAGE_THRESHOLDS.transfusedUnitsFourHours,
    };
    const positiveCriteria = Object.entries(criteria)
      .filter(([, matched]) => matched)
      .map(([criterion]) => criterion);

    return {
      severity: positiveCriteria.length >= 3 ? 'CRITICAL' : positiveCriteria.length >= 1 ? 'HIGH_RISK' : 'MONITOR',
      protocolReviewRecommended: positiveCriteria.length >= 2,
      matchedCriteria: positiveCriteria,
      shock,
      caveat: 'Activation must follow local massive hemorrhage policy and clinician judgment.',
    };
  }

  static recommendProtocols(patient) {
    const recommendations = [];
    const news2 = this.calculateNews2(patient);
    const qsofa = this.calculateQsofa(patient);
    const hemorrhage = this.assessHemorrhageRisk(patient);

    if (news2.total >= 7 || patient.triageCategory === 'IMMEDIATE') {
      recommendations.push(this.protocolRecommendation('CODE_RED', 'High-acuity physiology or immediate triage category'));
    }
    if (hemorrhage.protocolReviewRecommended) {
      recommendations.push(
        this.protocolRecommendation(
          'MASSIVE_TRANSFUSION',
          `Hemorrhage screen matched: ${hemorrhage.matchedCriteria.join(', ')}`,
        ),
      );
    }
    if (qsofa.elevatedRiskPrompt && patient.lactate >= 2 && patient.suspectedInfection !== false) {
      recommendations.push(
        this.protocolRecommendation('SEPSIS_HOUR_ONE', `qSOFA ${qsofa.score} with lactate ${patient.lactate} mmol/L`),
      );
    }
    if (patient.stemiConfirmed || patient.activeProtocol === 'CODE_STEMI') {
      recommendations.push(this.protocolRecommendation('CODE_STEMI', 'Clinician-documented STEMI pathway trigger'));
    }
    return recommendations;
  }

  static protocolRecommendation(protocolId, rationale) {
    const protocol = PROTOCOL_DEFINITIONS[protocolId];
    return {
      protocolId,
      label: protocol.label,
      rationale,
      authority: protocol.authority,
      requiresClinicianConfirmation: true,
    };
  }

  static createProtocolActivation({ protocolId, patient, actor, reason, secret }) {
    const protocol = PROTOCOL_DEFINITIONS[protocolId];
    if (!protocol) throw new Error(`Unknown emergency protocol: ${protocolId}`);
    if (!patient?.id || !patient?.mrn) throw new Error('Patient id and MRN are required');
    if (!actor?.id || !actor?.role) throw new Error('Authenticated actor id and role are required');
    if (!reason || reason.trim().length < 10) throw new Error('A clinical activation rationale is required');

    const timestamp = new Date().toISOString();
    const payload = {
      id: crypto.randomUUID(),
      protocolId,
      patientId: patient.id,
      patientMrn: patient.mrn,
      status: 'ACTIVE',
      activatedAt: timestamp,
      activatedBy: { id: actor.id, role: actor.role },
      reason: reason.trim(),
      requiredRoles: protocol.requiredRoles,
      checklist: protocol.checklist.map((label, index) => ({ id: `${protocolId}-${index + 1}`, label, completed: false })),
      acknowledgementDeadline: new Date(Date.now() + protocol.acknowledgementSeconds * 1000).toISOString(),
      standard: 'FDA-21-CFR-PART-11-AUDIT-CONTROLS',
    };
    const signature = crypto
      .createHmac('sha256', secret || process.env.CLINICAL_AUDIT_HMAC_KEY || 'local-development-only')
      .update(JSON.stringify(payload))
      .digest('hex');
    return { ...payload, signature, signatureAlgorithm: 'HMAC-SHA256' };
  }

  static toFhirR4Bundle(patient, assessment, activation = null) {
    const timestamp = new Date().toISOString();
    const entries = [
      {
        fullUrl: `urn:uuid:patient-${patient.id}`,
        resource: {
          resourceType: 'Patient',
          id: patient.id,
          identifier: [{ system: 'urn:medtrack:mrn', value: patient.mrn }],
          name: [{ text: patient.name }],
        },
      },
      this.fhirObservation(patient, '8867-4', 'Heart rate', patient.heartRate, '/min', 'beats/min'),
      this.fhirObservation(patient, '8480-6', 'Systolic blood pressure', patient.systolicBp, 'mm[Hg]', 'mmHg'),
      this.fhirObservation(patient, '9279-1', 'Respiratory rate', patient.respiratoryRate, '/min', 'breaths/min'),
      this.fhirObservation(patient, '59408-5', 'Oxygen saturation', patient.spo2, '%', '%'),
      {
        fullUrl: `urn:uuid:assessment-${patient.id}`,
        resource: {
          resourceType: 'RiskAssessment',
          id: `triage-${patient.id}`,
          status: 'final',
          subject: { reference: `Patient/${patient.id}` },
          occurrenceDateTime: timestamp,
          method: { text: patient.ageYears < 8 ? 'JumpSTART triage' : 'START triage' },
          prediction: [
            {
              outcome: { text: assessment.triage.label },
              rationale: assessment.triage.rationale,
            },
          ],
          note: [{ text: 'Decision support output requires clinician confirmation and serial reassessment.' }],
        },
      },
    ];

    if (activation) {
      entries.push({
        fullUrl: `urn:uuid:task-${activation.id}`,
        resource: {
          resourceType: 'Task',
          id: activation.id,
          status: 'in-progress',
          intent: 'order',
          code: { text: PROTOCOL_DEFINITIONS[activation.protocolId].label },
          for: { reference: `Patient/${patient.id}` },
          authoredOn: activation.activatedAt,
          requester: { display: `${activation.activatedBy.role} ${activation.activatedBy.id}` },
          note: [{ text: activation.reason }],
        },
      });
    }

    return {
      resourceType: 'Bundle',
      id: `emergency-triage-${patient.id}-${Date.now()}`,
      type: 'collection',
      timestamp,
      entry: entries,
    };
  }

  static fhirObservation(patient, loinc, display, value, code, unit) {
    return {
      fullUrl: `urn:uuid:observation-${loinc}-${patient.id}`,
      resource: {
        resourceType: 'Observation',
        id: `${loinc}-${patient.id}`,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              },
            ],
          },
        ],
        code: { coding: [{ system: 'http://loinc.org', code: loinc, display }] },
        subject: { reference: `Patient/${patient.id}` },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: { value, code, unit, system: 'http://unitsofmeasure.org' },
      },
    };
  }

  static createAssessment(patient) {
    const triage = patient.ageYears < 8 ? this.classifyJumpStart(patient) : this.classifyStart(patient);
    return {
      patientId: patient.id,
      assessedAt: new Date().toISOString(),
      triage,
      news2: this.calculateNews2(patient),
      qsofa: this.calculateQsofa(patient),
      shock: this.calculateShockIndex(patient),
      hemorrhage: this.assessHemorrhageRisk(patient),
      protocolRecommendations: this.recommendProtocols({ ...patient, triageCategory: triage.category }),
      disclaimer: 'Clinical decision support only. Confirm all actions with an appropriately qualified clinician.',
    };
  }
}

export default EmergencyTriageService;
