/**
 * The employer's statutory identity (#933, added in #951).
 *
 * Everything the Income Tax Department needs to know about *the deductor* when
 * a Form 16 or a Form 24Q is filed: who deducted the tax, under which TAN, at
 * which address, and who signs for it.
 *
 * `controllers/compliance.controller.js` has read this collection since #933
 * (`ComplianceConfig.findOne({ tenantId })`) and `workers/pdf.worker.js` has
 * rendered `employer.companyName`, `employer.tan` and `employer.pan` onto Part A
 * of the certificate. The model itself was never committed, so both files threw
 * `Cannot find module` on require and neither had ever run.
 *
 * One row per tenant. TAN and PAN are validated at the schema because they have
 * fixed government formats and a malformed one is not rejected when it is
 * entered — it is rejected by the NSDL utility at filing time, which is after
 * the deadline that matters.
 */

const mongoose = require('mongoose');

/** AAAA00000A — four letters, five digits, one letter. */
const TAN_PATTERN = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

/** AAAAA0000A — five letters, four digits, one letter. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const complianceConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
    },

    /** Name of the deductor as registered, not the trading name. */
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },

    tan: {
      type: String,
      required: [true, 'TAN is required'],
      trim: true,
      uppercase: true,
      match: [TAN_PATTERN, 'TAN must be in the format AAAA00000A'],
    },

    pan: {
      type: String,
      required: [true, 'PAN is required'],
      trim: true,
      uppercase: true,
      match: [PAN_PATTERN, 'PAN must be in the format AAAAA0000A'],
    },

    address: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },

    /**
     * The category the deductor files under. Drives which annexures a return
     * needs; recorded here so the export does not have to guess.
     */
    deductorType: {
      type: String,
      enum: ['company', 'firm', 'individual', 'government', 'trust'],
      default: 'company',
    },

    /**
     * The person answerable for the deduction. A Form 16 is signed by a named
     * human, not by a company, and the return is rejected without them.
     */
    responsiblePerson: {
      name: { type: String, default: '', trim: true, maxlength: 120 },
      designation: { type: String, default: '', trim: true, maxlength: 120 },
      pan: {
        type: String,
        default: '',
        trim: true,
        uppercase: true,
        // Optional, unlike the employer's: validated only when supplied, so a
        // tenant can save its TAN before it knows who will sign.
        validate: {
          validator: (v) => !v || PAN_PATTERN.test(v),
          message: 'Responsible person PAN must be in the format AAAAA0000A',
        },
      },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const ComplianceConfig = mongoose.model(
  'ComplianceConfig',
  complianceConfigSchema,
);

ComplianceConfig.TAN_PATTERN = TAN_PATTERN;
ComplianceConfig.PAN_PATTERN = PAN_PATTERN;

module.exports = ComplianceConfig;
