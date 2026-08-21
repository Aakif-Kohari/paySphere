"use strict";

const mongoose = require("mongoose");

/**
 * ICU Clinical Telemetry and Hemodynamics Surveillance Model
 *
 * Implements high-assurance telemetry tracking for critical care units (CCU/ICU).
 * Conforms to HL7 FHIR R4 Observation & RiskAssessment resources and FDA 21 CFR Part 11
 * cryptographic electronic signature audit requirements.
 */

const hemodynamicReadingSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    heartRateBpm: {
      type: Number,
      required: true,
      min: 20,
      max: 280,
    },
    systolicBpMmHg: {
      type: Number,
      required: true,
      min: 30,
      max: 300,
    },
    diastolicBpMmHg: {
      type: Number,
      required: true,
      min: 10,
      max: 200,
    },
    meanArterialPressureMmHg: {
      type: Number,
      required: true,
    },
    centralVenousPressureMmHg: {
      type: Number,
      default: null,
      min: -5,
      max: 40,
    },
    pulmonaryCapillaryWedgePressureMmHg: {
      type: Number,
      default: null,
      min: 0,
      max: 50,
    },
    cardiacOutputLpm: {
      type: Number,
      required: true,
      min: 0.5,
      max: 25.0,
    },
    cardiacIndexLpmM2: {
      type: Number,
      required: true,
      min: 0.2,
      max: 12.0,
    },
    cardiacPowerOutputWatts: {
      type: Number,
      required: true,
      min: 0.0,
      max: 5.0,
    },
    systemicVascularResistanceDynsCm5: {
      type: Number,
      required: true,
      min: 100,
      max: 4000,
    },
    strokeVolumeMl: {
      type: Number,
      required: true,
      min: 5,
      max: 200,
    },
    leftVentricularStrokeWorkIndexGmPerM2: {
      type: Number,
      default: null,
      min: 0,
      max: 150,
    },
    mixedVenousO2SatPercent: {
      type: Number,
      default: 75.0,
      min: 20.0,
      max: 100.0,
    },
    arterialLactateMmolL: {
      type: Number,
      required: true,
      min: 0.1,
      max: 30.0,
    },
    arterialPh: {
      type: Number,
      default: 7.40,
      min: 6.5,
      max: 7.9,
    },
    paO2MmHg: {
      type: Number,
      default: 95.0,
    },
    paCO2MmHg: {
      type: Number,
      default: 40.0,
    },
    hco3MeqL: {
      type: Number,
      default: 24.0,
    },
  },
  { _id: false }
);

const emergencyProtocolEventSchema = new mongoose.Schema(
  {
    protocolType: {
      type: String,
      enum: [
        "CODE_RED_CARDIAC_ARREST",
        "CODE_STEMI_CATH_LAB_ACTIVATION",
        "SURVIVING_SEPSIS_HOUR_ONE_BUNDLE",
        "MASSIVE_TRANSFUSION_PROTOCOL_MTP",
        "CRRT_RENAL_REPLACEMENT_TRIGGER",
        "ECMO_CANNULATION_ALERT",
      ],
      required: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    triggeredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    triggeredByRole: {
      type: String,
      required: true,
    },
    clinicalRationale: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RESPONDING", "STABILIZED", "ESCALATED", "RESOLVED"],
      default: "ACTIVE",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    fda21CfrSignatureHash: {
      type: String,
      required: true,
    },
  },
  { _id: true }
);

const clinicalTelemetrySchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    mrn: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    patientFullName: {
      type: String,
      required: true,
      trim: true,
    },
    ageYears: {
      type: Number,
      required: true,
      min: 0,
      max: 130,
    },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "UNKNOWN"],
      required: true,
    },
    bodySurfaceAreaM2: {
      type: Number,
      required: true,
      min: 0.5,
      max: 3.5,
    },
    icuBedNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    unitWard: {
      type: String,
      default: "CARDIOTHORACIC_ICU_A",
      trim: true,
    },
    admissionDiagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    acuityStatus: {
      type: String,
      enum: ["STABLE", "GUARDED", "CRITICAL", "CARDIOGENIC_SHOCK", "CODE_BLUE"],
      default: "GUARDED",
      index: true,
    },
    mechanicalSupport: {
      type: String,
      enum: ["NONE", "IMPELLA_CP", "VA_ECMO", "VV_ECMO", "IABP", "VENTILATOR_SIMV"],
      default: "NONE",
    },
    vasopressorInotropicScore: {
      type: Number,
      default: 0.0,
      min: 0.0,
    },
    latestReadings: hemodynamicReadingSchema,
    telemetryHistory: {
      type: [hemodynamicReadingSchema],
      default: [],
    },
    qSofaScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    news2Score: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
    },
    kdigoAkiStage: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    emergencyProtocols: {
      type: [emergencyProtocolEventSchema],
      default: [],
    },
    fhirResourceIdentifier: {
      type: String,
      unique: true,
      sparse: true,
    },
    isLiveMonitoringActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "clinical_telemetry_streams",
  }
);

clinicalTelemetrySchema.index({ unitWard: 1, acuityStatus: 1 });
clinicalTelemetrySchema.index({ icuBedNumber: 1, isLiveMonitoringActive: 1 });

const ClinicalTelemetry = mongoose.model("ClinicalTelemetry", clinicalTelemetrySchema);

module.exports = ClinicalTelemetry;
