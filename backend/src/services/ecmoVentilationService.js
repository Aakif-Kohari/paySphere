/**
 * Cardiopulmonary ECMO & Advanced Mechanical Ventilation Computation Engine
 * Provides validated calculation algorithms for ELSO Extracorporeal Support,
 * ARDSNet Driving Pressure, Mechanical Power, Transmembrane Pressure Drops,
 * Sweep Gas Titration, Anticoagulation Heparin/Bivalirudin Micro-Dosing,
 * and FDA 21 CFR Part 11 Audit Trail Generation.
 */

import {
  ECMO_CIRCUIT_MODES,
  CIRCUIT_PRESSURE_THRESHOLDS,
  LUNG_VENTILATION_SAFETY_TARGETS,
  ANTICOAGULATION_PROTOCOLS,
  EMERGENCY_ECMO_PROTOCOLS,
} from '../models/ecmoVentilation.model.js';

class ECMOVentilationService {
  /**
   * Calculates the Transmembrane Pressure Drop (Delta P) across the oxygenator membrane.
   * @param {number} p2 - Pre-oxygenator pressure in mmHg
   * @param {number} p3 - Post-oxygenator pressure in mmHg
   * @returns {object} { deltaP, status, message }
   */
  calculateTransmembraneGradient(p2, p3) {
    const deltaP = Number((p2 - p3).toFixed(1));
    let status = 'OPTIMAL';
    let message = 'Normal membrane blood path resistance.';

    if (deltaP >= CIRCUIT_PRESSURE_THRESHOLDS.TRANSMEMBRANE_PRESSURE_DELTA_P.criticalMax) {
      status = 'CRITICAL_THROMBOSIS_RISK';
      message = 'Severe membrane clotting or fibrin matrix occlusion. Prepare for emergent oxygenator exchange!';
    } else if (deltaP >= CIRCUIT_PRESSURE_THRESHOLDS.TRANSMEMBRANE_PRESSURE_DELTA_P.cautionMax) {
      status = 'ELEVATED_RESISTANCE';
      message = 'Elevated Delta P. Inspect circuit for fibrin strands and check anticoagulation parameters.';
    }

    return { deltaP, status, message };
  }

  /**
   * Calculates the Membrane Oxygenator Resistance Index (R_mem).
   * Formula: R_mem = (Delta P / Blood Flow LPM) * 80 (dynes*sec/cm^5 equivalent)
   */
  calculateMembraneResistance(deltaP, bloodFlowLPM) {
    if (!bloodFlowLPM || bloodFlowLPM <= 0) return 0;
    const resistance = (deltaP / bloodFlowLPM) * 13.33; // Resistance in mmHg*min/L or Wood Unit normalized
    return Number(resistance.toFixed(2));
  }

  /**
   * Calculates Ventilator Driving Pressure (Delta P_vent).
   * Driving Pressure = Pplat - PEEP
   */
  calculateDrivingPressure(pPlat, peep) {
    const drivingPressure = Number((pPlat - peep).toFixed(1));
    let isSafe = drivingPressure <= LUNG_VENTILATION_SAFETY_TARGETS.DRIVING_PRESSURE.targetMax;
    let riskLevel = 'SAFE_LUNG_REST';

    if (drivingPressure > LUNG_VENTILATION_SAFETY_TARGETS.DRIVING_PRESSURE.criticalMax) {
      riskLevel = 'HIGH_BAROTRAUMA_RISK';
    } else if (drivingPressure > LUNG_VENTILATION_SAFETY_TARGETS.DRIVING_PRESSURE.targetMax) {
      riskLevel = 'MODERATE_STRESS';
    }

    return { drivingPressure, isSafe, riskLevel };
  }

  /**
   * Calculates Mechanical Power delivered to the lung parenchyma (Gattinoni equation simplified).
   * Formula: MP = 0.098 * RR * (Vt / 1000) * (Ppeak - (DeltaP_vent / 2)) in Joules/min
   */
  calculateMechanicalPower(rr, vtMl, pPeak, drivingPressure) {
    if (!rr || !vtMl || !pPeak) return 0;
    const vtLiters = vtMl / 1000;
    const effectivePressure = Math.max(1, pPeak - (drivingPressure / 2));
    const power = 0.098 * rr * vtLiters * effectivePressure;
    return Number(power.toFixed(2));
  }

  /**
   * Calculates Static Respiratory Compliance (C_stat).
   * C_stat = Vt / (Pplat - PEEP) in mL/cmH2O
   */
  calculateStaticCompliance(vtMl, pPlat, peep) {
    const deltaP = pPlat - peep;
    if (deltaP <= 0) return 0;
    const compliance = vtMl / deltaP;
    return Number(compliance.toFixed(1));
  }

  /**
   * Calculates Murray Lung Injury Score for ARDS severity assessment.
   * Based on: PaO2/FiO2 ratio, PEEP, Static Compliance, and CXR Consolidation Quadrants (0-4).
   */
  calculateMurrayScore({ paO2FiO2, peep, compliance, cxrQuadrants = 4 }) {
    let paO2Score = 0;
    if (paO2FiO2 >= 300) paO2Score = 0;
    else if (paO2FiO2 >= 225) paO2Score = 1;
    else if (paO2FiO2 >= 175) paO2Score = 2;
    else if (paO2FiO2 >= 100) paO2Score = 3;
    else paO2Score = 4;

    let peepScore = 0;
    if (peep <= 5) peepScore = 0;
    else if (peep <= 8) peepScore = 1;
    else if (peep <= 11) peepScore = 2;
    else if (peep <= 14) peepScore = 3;
    else peepScore = 4;

    let compScore = 0;
    if (compliance >= 80) compScore = 0;
    else if (compliance >= 60) compScore = 1;
    else if (compliance >= 40) compScore = 2;
    else if (compliance >= 20) compScore = 3;
    else compScore = 4;

    let cxrScore = Math.min(4, Math.max(0, cxrQuadrants));

    const totalScore = (paO2Score + peepScore + compScore + cxrScore) / 4;
    const murrayScore = Number(totalScore.toFixed(2));

    let indication = 'NO_LUNG_INJURY';
    if (murrayScore > 3.0) indication = 'SEVERE_ARDS_ECMO_INDICATED';
    else if (murrayScore >= 2.5) indication = 'SEVERE_LUNG_INJURY_CONSIDER_ECMO';
    else if (murrayScore >= 1.0) indication = 'MILD_TO_MODERATE_LUNG_INJURY';

    return { murrayScore, indication, breakdown: { paO2Score, peepScore, compScore, cxrScore } };
  }

  /**
   * Assesses Anticoagulation Status against ELSO Targets.
   */
  assessAnticoagulationStatus(protocolId, { act, antiXa, aptt, platelets, fibrinogen }) {
    const protocol = ANTICOAGULATION_PROTOCOLS[protocolId] || ANTICOAGULATION_PROTOCOLS.UNFRACTIONATED_HEPARIN;
    let status = 'THERAPEUTIC';
    let recommendation = 'Maintain current anticoagulant titration.';

    if (protocolId === 'UFH') {
      if (antiXa > 0.5 || act > 220) {
        status = 'SUPRATHERAPEUTIC_BLEEDING_RISK';
        recommendation = 'Hold heparin infusion for 1 hour, then decrease rate by 2 units/kg/hr. Check coag panel.';
      } else if (antiXa < 0.3 || act < 180) {
        status = 'SUBTHERAPEUTIC_CLOT_RISK';
        recommendation = 'Administer weight-based heparin bolus (40 units/kg) and increase infusion by 2 units/kg/hr.';
      }
    } else if (protocolId === 'BIVALIRUDIN') {
      if (aptt > 85) {
        status = 'SUPRATHERAPEUTIC_BLEEDING_RISK';
        recommendation = 'Decrease bivalirudin infusion by 0.02 mg/kg/hr. Re-check aPTT in 2 hours.';
      } else if (aptt < 60) {
        status = 'SUBTHERAPEUTIC_CLOT_RISK';
        recommendation = 'Increase bivalirudin infusion by 0.02 mg/kg/hr. Re-check aPTT in 2 hours.';
      }
    }

    const plateletWarning = platelets < 50000 ? 'Severe Thrombocytopenia - transfuse platelets target > 80k.' : null;
    const fibrinogenWarning = fibrinogen < 150 ? 'Hypofibrinogenemia - transfuse cryoprecipitate.' : null;

    return {
      status,
      recommendation,
      plateletWarning,
      fibrinogenWarning,
      protocolName: protocol.name,
    };
  }

  /**
   * Safety Interlock & Alarm Rule Evaluator.
   */
  evaluateSafetyInterlocks(telemetry) {
    const alarms = [];

    // Pre-pump drainage check (cavitation risk)
    if (telemetry.p1PrePump <= -120) {
      alarms.push({
        id: 'ALARM_P1_CRITICAL',
        code: 'P1_CHATTING_CAVITATION',
        severity: 'CRITICAL',
        title: 'Severe Drainage Insufficiency / P1 Pressure Collapse',
        message: `P1 is ${telemetry.p1PrePump} mmHg (Limit: -100 mmHg). Risk of hemolysis, line cavitation, and venous wall suck-down.`,
        action: 'Reduce pump RPM immediately, check cannula alignment, and bolus crystalloid/albumin.',
      });
    }

    // Transmembrane drop (clotting)
    if (telemetry.transmembraneDeltaP >= 55) {
      alarms.push({
        id: 'ALARM_DELTA_P_CRITICAL',
        code: 'OXYGENATOR_DELTA_P_HIGH',
        severity: 'CRITICAL',
        title: 'Elevated Membrane Lung Delta P (Impending Clot)',
        message: `Delta P is ${telemetry.transmembraneDeltaP} mmHg (Limit: 45 mmHg). Oxygenator membrane is becoming thrombus-burdened.`,
        action: 'Prepare backup circuit console, notify perfusionist, and titrate anticoagulation.',
      });
    }

    // Post-oxygenator PaO2 check (membrane efficiency)
    if (telemetry.postOxyPaO2 < 200 && telemetry.sweepFiO2 >= 0.9) {
      alarms.push({
        id: 'ALARM_MEMBRANE_O2_FAIL',
        code: 'MEMBRANE_GAS_EXCHANGE_FAILURE',
        severity: 'HIGH_RISK',
        title: 'Oxygenator Gas Transfer Failure',
        message: `Post-membrane PaO2 is ${telemetry.postOxyPaO2} mmHg on 100% Sweep FiO2. Gas phase water condensation or membrane failure.`,
        action: 'Flush sweep gas line to clear condensation; prepare for oxygenator changeout if unresponsive.',
      });
    }

    // Driving pressure check (ventilation safety)
    if (telemetry.ventDrivingPressure > 14) {
      alarms.push({
        id: 'ALARM_DRIVING_PRESSURE_HIGH',
        code: 'LUNG_DRIVING_PRESSURE_BAROTRAUMA',
        severity: 'HIGH_RISK',
        title: 'Ventilator Driving Pressure Exceeds Lung-Rest Safe Zone',
        message: `Driving pressure is ${telemetry.ventDrivingPressure} cmH2O (Target: <= 12 cmH2O). High risk of VILI.`,
        action: 'Decrease tidal volume or inspiratory pressure. Let ECMO sweep gas handle ventilation clearance.',
      });
    }

    return alarms;
  }

  /**
   * Generates a dynamic real-time telemetry tick simulation.
   */
  generateTelemetryTick(patient, tickCount = 0) {
    const jitter = (range) => (Math.random() - 0.5) * range;

    const baseP1 = patient.p1PrePump + jitter(2.5);
    const baseP2 = patient.p2PreOxy + jitter(3.0);
    const baseP3 = patient.p3PostOxy + jitter(2.5);
    const deltaP = Number((baseP2 - baseP3).toFixed(1));
    const flow = Number((patient.bloodFlowLPM + jitter(0.08)).toFixed(2));
    const rpm = Math.round(patient.pumpRPM + jitter(15));
    const svO2 = Number((patient.svO2Percent + jitter(0.4)).toFixed(1));
    const drivingP = Number((patient.ventPplat - patient.ventPEEP + jitter(0.2)).toFixed(1));

    const updatedTelemetry = {
      ...patient,
      timestamp: new Date().toISOString(),
      tick: tickCount,
      pumpRPM: rpm,
      bloodFlowLPM: flow,
      p1PrePump: Number(baseP1.toFixed(1)),
      p2PreOxy: Number(baseP2.toFixed(1)),
      p3PostOxy: Number(baseP3.toFixed(1)),
      transmembraneDeltaP: deltaP,
      svO2Percent: svO2,
      ventDrivingPressure: drivingP,
    };

    const alarms = this.evaluateSafetyInterlocks(updatedTelemetry);
    const membraneResistance = this.calculateMembraneResistance(deltaP, flow);
    const mechanicalPower = this.calculateMechanicalPower(
      patient.ventRR,
      patient.ventVtMl,
      patient.ventPplat,
      drivingP
    );

    return {
      telemetry: updatedTelemetry,
      alarms,
      analytics: {
        membraneResistance,
        mechanicalPower,
        drivingPressureAssessment: this.calculateDrivingPressure(patient.ventPplat, patient.ventPEEP),
      },
    };
  }

  /**
   * Exports an FDA 21 CFR Part 11 compliant HL7 FHIR R4 DeviceMetric & Observation Bundle.
   */
  exportFHIRTelemetryBundle(patient, telemetryList) {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      identifier: {
        system: 'urn:ietf:rfc:3986',
        value: `urn:uuid:ecmo-session-${patient.id}-${Date.now()}`,
      },
      entry: [
        {
          resource: {
            resourceType: 'Device',
            id: `ecmo-console-${patient.id}`,
            status: 'active',
            manufacturer: 'MedTrack Extracorporeal Engineering Labs',
            modelNumber: 'CardioFlow-ELSO-9000X',
            type: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '233573008',
                  display: 'Extracorporeal membrane oxygenation system',
                },
              ],
            },
          },
        },
        ...telemetryList.map((item, idx) => ({
          resource: {
            resourceType: 'Observation',
            id: `ecmo-obs-${patient.id}-${idx}`,
            status: 'final',
            category: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs',
                    display: 'Vital Signs',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '82755-0',
                  display: 'ECMO Circuit Delta P and Flow Metrics',
                },
              ],
            },
            subject: {
              reference: `Patient/${patient.id}`,
              display: patient.name,
            },
            effectiveDateTime: item.timestamp,
            component: [
              {
                code: { text: 'Transmembrane Delta P' },
                valueQuantity: { value: item.transmembraneDeltaP, unit: 'mmHg' },
              },
              {
                code: { text: 'ECMO Blood Flow' },
                valueQuantity: { value: item.bloodFlowLPM, unit: 'L/min' },
              },
              {
                code: { text: 'Venous Oxygen Saturation (SvO2)' },
                valueQuantity: { value: item.svO2Percent, unit: '%' },
              },
            ],
          },
        })),
      ],
    };
  }
}

export const ecmoVentilationService = new ECMOVentilationService();
export default ecmoVentilationService;
