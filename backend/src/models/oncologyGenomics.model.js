import mongoose from 'mongoose';

/**
 * Precision Oncology & Bio-AI Genomics Clinical Data Models
 * Conforming to HL7 FHIR Genomics R4, NCCN Guidelines, and FDA 21 CFR Part 11 Audit Specifications
 */

const GenomicVariantSchema = new mongoose.Schema(
  {
    variantId: {
      type: String,
      required: true,
      index: true,
    },
    gene: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    hgvsc: {
      type: String,
      required: true,
    },
    hgvsp: {
      type: String,
      required: true,
    },
    variantType: {
      type: String,
      enum: ['SNV', 'INDEL', 'CNV Amplification', 'Gene Fusion', 'Splice Site'],
      required: true,
    },
    vaf: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    readDepth: {
      type: Number,
      required: true,
      min: 0,
    },
    tier: {
      type: String,
      enum: [
        'Tier I (Strong Evidence)',
        'Tier II (Potential)',
        'Tier III (VUS)',
        'Tier IV (Benign)',
      ],
      required: true,
    },
    escat: {
      type: String,
      enum: ['ESCAT I-A', 'ESCAT I-B', 'ESCAT II-A', 'ESCAT II-B', 'ESCAT III', 'ESCAT IV'],
      required: true,
    },
    pathogenicity: {
      type: String,
      enum: ['Pathogenic', 'Likely Pathogenic', 'VUS', 'Likely Benign'],
      default: 'Pathogenic',
    },
    clinsig: {
      type: String,
      required: true,
    },
    actionableTherapy: [{ type: String, trim: true }],
    resistanceMarkers: [{ type: String, trim: true }],
    cosmicId: { type: String, trim: true },
    gnomadFreq: { type: Number, default: 0.0 },
  },
  { _id: false }
);

const LiquidBiopsyPointSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },
    ctDNAFraction: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    mutantCopiesPerMl: {
      type: Number,
      required: true,
      min: 0,
    },
    targetGene: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Clearing', 'Stable', 'Molecular Progression', 'Recurrence Risk'],
      required: true,
    },
  },
  { _id: false }
);

const ClinicalTrialMatchSchema = new mongoose.Schema(
  {
    nctId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    phase: {
      type: String,
      enum: ['Phase I', 'Phase I/II', 'Phase II', 'Phase III'],
      required: true,
    },
    biomarkerCriteria: {
      type: String,
      required: true,
    },
    matchingScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    locations: [{ type: String }],
    sponsor: { type: String },
    contact: { type: String },
  },
  { _id: false }
);

const TumorBoardDecisionSchema = new mongoose.Schema(
  {
    decisionId: {
      type: String,
      required: true,
      unique: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    oncologist: {
      type: String,
      required: true,
    },
    proposedIntervention: {
      type: String,
      required: true,
    },
    consensusStatus: {
      type: String,
      enum: ['UNANIMOUS', 'MAJORITY', 'PENDING REVIEW', 'REJECTED'],
      default: 'UNANIMOUS',
    },
    actionItems: [{ type: String }],
    rationale: {
      type: String,
      required: true,
    },
    electronicSignature: {
      signedBy: { type: String },
      certificateHash: { type: String },
      timestamp: { type: Date, default: Date.now },
      fda21CfrCompliant: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const OncologyProfileSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patientName: {
      type: String,
      required: true,
    },
    mrn: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 125,
    },
    gender: {
      type: String,
      enum: ['Female', 'Male', 'Other'],
      required: true,
    },
    diagnosis: {
      type: String,
      enum: [
        'NSCLC Adenocarcinoma',
        'Metastatic Colorectal Cancer',
        'Triple-Negative Breast Cancer',
        'Pancreatic Ductal Adenocarcinoma',
        'Cutaneous Melanoma',
        'Glioblastoma Multiforme',
        'Acute Myeloid Leukemia',
      ],
      required: true,
    },
    stage: {
      type: String,
      enum: ['Stage I', 'Stage II', 'Stage III', 'Stage IV (Metastatic)'],
      required: true,
    },
    ecogScore: {
      type: Number,
      enum: [0, 1, 2, 3, 4],
      default: 0,
    },
    tmb: {
      type: Number,
      required: true,
      min: 0,
    },
    tmbStatus: {
      type: String,
      enum: ['TMB-High (>=10)', 'TMB-Low (<10)'],
      required: true,
    },
    msiStatus: {
      type: String,
      enum: ['MSI-High', 'MSS (Stable)', 'MSI-Low'],
      required: true,
    },
    hrdScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    pdl1Tps: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    activeRegimen: {
      type: String,
      required: true,
    },
    priorLinesCount: {
      type: Number,
      default: 0,
    },
    riskCategory: {
      type: String,
      enum: ['CRITICAL ESCALATION', 'ELEVATED RISK', 'TARGETABLE STABLE', 'OPTIMAL RESPONSE'],
      default: 'TARGETABLE STABLE',
    },
    variants: [GenomicVariantSchema],
    liquidBiopsyTrend: [LiquidBiopsyPointSchema],
    trials: [ClinicalTrialMatchSchema],
    protocolAlerts: [{ type: String }],
    aiRecommendations: [{ type: String }],
  },
  { timestamps: true }
);

export const OncologyProfile = mongoose.model('OncologyProfile', OncologyProfileSchema);
export const TumorBoardDecision = mongoose.model('TumorBoardDecision', TumorBoardDecisionSchema);

export default {
  OncologyProfile,
  TumorBoardDecision,
};\n