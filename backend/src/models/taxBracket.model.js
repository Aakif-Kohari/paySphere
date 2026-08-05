const mongoose = require('mongoose');
const { validateSlabs } = require('../utils/taxCalculator');

/**
 * A region's tax slab table (#586, validated in #616).
 *
 * `#586` accepted anything: a rate of -5 or 900, a slab whose floor is above
 * its ceiling, an empty table. None of those produce an error at calculation
 * time — they produce a wrong number, which is the worst failure mode there is
 * for a payroll deduction.
 *
 * The structural rules — sorted, contiguous, non-overlapping, exactly one
 * open-ended slab and it has to be the highest — cannot be expressed per field,
 * so they are checked against the whole array by utils/taxCalculator.js.
 */
const bracketSchema = new mongoose.Schema(
  {
    minIncome: {
      type: Number,
      required: true,
      min: [0, 'Slab floor cannot be negative'],
    },

    /**
     * The slab's ceiling. `null` or absent means open-ended, and only the
     * highest slab may be.
     *
     * `#586` tested this for truthiness, so a ceiling of `0` was read as
     * "unbounded" and the slab swallowed every rupee above its floor at its own
     * rate.
     */
    maxIncome: {
      type: Number,
      default: null,
      min: [0, 'Slab ceiling cannot be negative'],
    },

    ratePercentage: {
      type: Number,
      required: true,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },

    /**
     * A flat amount added once, on the slab the income lands in — the
     * "₹12,500 + 20% of the amount over ₹5,00,000" form.
     *
     * `#586` added it inside the slab loop, so an income reaching the fourth
     * slab paid all four slabs' fixed components.
     *
     * The name is misleading: it increases the tax rather than reducing it.
     * Left alone here because renaming a persisted field is a migration, not a
     * bug fix — worth its own issue.
     */
    fixedDeduction: {
      type: Number,
      default: 0,
      min: [0, 'Fixed component cannot be negative'],
    },
  },
  { _id: false },
);

const taxBracketSchema = new mongoose.Schema(
  {
    region: { type: String, required: true, trim: true },
    currency: { type: String, required: true, default: 'INR', trim: true },

    brackets: {
      type: [bracketSchema],
      validate: {
        // Runs on save() and on update with runValidators. It cannot catch a
        // table written by updateMany, which skips validators by default —
        // which is why tax.service.js checks again before it charges anything.
        validator: (brackets) => validateSlabs(brackets).length === 0,
        message: (props) => validateSlabs(props.value).join('; '),
      },
    },

    socialSecurityRate: {
      type: Number,
      default: 0,
      min: [0, 'Social security rate cannot be negative'],
      max: [100, 'Social security rate cannot exceed 100%'],
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  { timestamps: true },
);

// One table per region per company. Without this, two configurations for the
// same region can coexist and `findOne` returns whichever the storage engine
// hands back first — so the tax an employee pays depends on insertion order.
taxBracketSchema.index({ tenantId: 1, region: 1 }, { unique: true });

module.exports = mongoose.model('TaxBracket', taxBracketSchema);
