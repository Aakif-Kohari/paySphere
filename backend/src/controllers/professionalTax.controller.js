/**
 * @fileoverview Professional tax — state rules, certificates and the year
 * (#1876).
 *
 * Three decisions carry this controller.
 *
 * **A rule change is a new document, never an edit.** `upsertRule` keys on
 * `(state, effectiveFrom)`, so amending Karnataka's threshold in April 2023
 * leaves the pre-April table intact and a re-run for March reproduces it. An
 * endpoint that edited the rule in place would make every historical payslip
 * unreproducible and nothing would fail while it happened.
 *
 * **The work state comes from the profile and is never inferred.** Not from the
 * employee's address, not from the tenant's registered office. Professional tax
 * follows the place of work, and for anyone working away from where they live —
 * every remote employee on the rolls of a branch — the address gives the wrong
 * state while the deduction still looks reasonable. An employee with no profile
 * is reported as a finding rather than defaulted into a state.
 *
 * **Accrued and paid are answered by different endpoints.** `/assessment`
 * computes what is owed; `/payments` records what reached the state; and only
 * the second feeds `paidForSection16iii`. Section 16(iii) allows professional
 * tax actually paid, so an amount deducted in March and remitted in April
 * belongs to the following year — and feeding the accrual into the salary
 * computation would understate taxable income and therefore TDS.
 *
 * Everything that decides a slab, a period or a ceiling is in
 * `utils/professionalTax.js`.
 */

const mongoose = require('mongoose');

const {
  ProfessionalTaxRule,
  ProfessionalTaxRegistration,
  ProfessionalTaxPayment,
  ProfessionalTaxAssessment,
  ProfessionalTaxProfile,
} = require('../models/professionalTax.model');
const Payroll = require('../models/payroll.model');
const {
  ANNUAL_CEILING,
  PERIODICITY,
  CERTIFICATE,
  EXEMPTION,
  CATEGORY,
  SEED_RULES,
  resolveRule,
  assessEstablishment,
} = require('../utils/professionalTax');
const eventBus = require('../services/event.service');

/**
 * The financial year a date falls in — the year its April belongs to.
 *
 * @param {Date} [date]
 * @returns {number}
 */
function financialYearOf(date = new Date()) {
  return date.getUTCMonth() + 1 >= 4
    ? date.getUTCFullYear()
    : date.getUTCFullYear() - 1;
}

/**
 * The tenant's dated rules, with the seeds behind them.
 *
 * Seeds are appended rather than replaced so that a tenant that has configured
 * Maharashtra still gets a defensible answer for Karnataka. `resolveRule` picks
 * the latest rule effective on the date, and a tenant rule with a later
 * effective date wins on that basis rather than by precedence — which is the
 * right behaviour, because a tenant configuring a state is telling us the seed
 * is out of date from that day and not before it.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @returns {Promise<Array<object>>}
 */
async function loadRuleSets(tenantId) {
  const stored = await ProfessionalTaxRule.find({ tenantId }).lean();

  return [
    ...SEED_RULES,
    ...stored.map((rule) => ({
      state: rule.state,
      name: rule.name,
      effectiveFrom: rule.effectiveFrom,
      periodicity: rule.periodicity,
      levyLevel: rule.levyLevel,
      requiresLocalBody: rule.requiresLocalBody,
      slabs: rule.slabs,
      specialMonth: rule.specialMonth?.month
        ? { month: rule.specialMonth.month, amount: rule.specialMonth.amount }
        : undefined,
      categorySlabs: rule.categorySlabs
        ? Object.fromEntries(rule.categorySlabs)
        : undefined,
      enrolmentAnnualAmount: rule.enrolmentAnnualAmount,
    })),
  ];
}

/**
 * The wage months for a financial year, per employee, from the payroll runs.
 *
 * The gross is built the same way `complianceAggregator.js` builds it — base
 * plus bonus plus overtime plus arrears — rather than read off a `grossSalary`
 * field, because the payroll model does not carry one and the two would drift
 * apart the moment either changed.
 *
 * Gross rather than basic on purpose. Every one of the seeded state enactments
 * levies on salary or wages read as the whole emolument rather than as a
 * basic-plus-DA figure, so taking basic here would put most of a payroll in a
 * lower slab and understate the deduction on every payslip.
 *
 * @param {mongoose.Types.ObjectId} tenantId
 * @param {number} financialYear
 * @returns {Promise<{byEmployee: Map<string, Array<{year: number, month: number, salary: number}>>}>}
 */
async function loadWageMonths(tenantId, financialYear) {
  // April of the financial year through March of the next, expressed against
  // the model's separate `year` and `month` fields rather than against a date
  // range — `{year: {$gte}, month: {$gte: 4}}` would exclude January to March,
  // which are inside the year.
  const runs = await Payroll.find({
    tenantId,
    $or: [
      { year: financialYear, month: { $gte: 4 } },
      { year: financialYear + 1, month: { $lte: 3 } },
    ],
  })
    .select('employeeId year month baseSalary bonus overtimePay arrearsPayout')
    .lean();

  const byEmployee = new Map();

  for (const run of runs) {
    const key = String(run.employeeId);
    if (!byEmployee.has(key)) byEmployee.set(key, []);

    byEmployee.get(key).push({
      year: run.year,
      month: run.month,
      salary:
        (Number(run.baseSalary) || 0) +
        (Number(run.bonus) || 0) +
        (Number(run.overtimePay) || 0) +
        (Number(run.arrearsPayout) || 0),
    });
  }

  // An employee with no run in a month gets nothing for it rather than a zero
  // row. It matters for the half-yearly states: a missing month and a nil month
  // aggregate identically, and both are the right answer.
  return { byEmployee };
}

/**
 * Compute the year's position.
 *
 * @param {object} input
 * @param {mongoose.Types.ObjectId} input.tenantId
 * @param {number} input.financialYear
 * @returns {Promise<object>}
 */
async function computeYear({ tenantId, financialYear }) {
  const ruleSets = await loadRuleSets(tenantId);
  const profiles = await ProfessionalTaxProfile.find({ tenantId })
    .populate('employeeId', 'name')
    .lean();

  const { byEmployee } = await loadWageMonths(tenantId, financialYear);

  const registrations = await ProfessionalTaxRegistration.find({
    tenantId,
    certificate: CERTIFICATE.ENROLMENT,
  }).lean();

  const payments = await ProfessionalTaxPayment.find({
    tenantId,
    paidOn: {
      $gte: new Date(Date.UTC(financialYear, 3, 1)),
      $lte: new Date(Date.UTC(financialYear + 1, 2, 31)),
    },
  }).lean();

  const enrolments = registrations.map((row) => {
    const rule = resolveRule(
      row.state,
      new Date(Date.UTC(financialYear, 3, 1)),
      ruleSets,
    );

    return {
      state: row.state,
      enrolled: row.active,
      annualAmount: rule?.enrolmentAnnualAmount || 0,
    };
  });

  const result = assessEstablishment({
    financialYear,
    ruleSets,
    enrolments,
    payments: payments.map((row) => ({
      paidOn: row.paidOn,
      amount: row.amount,
    })),
    employees: profiles.map((profile) => ({
      employee: {
        employeeId: profile.employeeId?._id || profile.employeeId,
        name: profile.employeeId?.name || '',
        workState: profile.workState,
        localBody: profile.localBody,
        category: profile.category,
        exemptions: profile.exemptions,
      },
      wageMonths:
        byEmployee.get(String(profile.employeeId?._id || profile.employeeId)) ||
        [],
    })),
  });

  return { result, ruleSets, profileCount: profiles.length };
}

/**
 * GET /api/professional-tax/rules
 */
exports.listRules = async (req, res, next) => {
  try {
    const stored = await ProfessionalTaxRule.find({ tenantId: req.tenantId })
      .sort({ state: 1, effectiveFrom: -1 })
      .lean();

    return res.json({
      annualCeiling: ANNUAL_CEILING,
      seeded: SEED_RULES,
      rules: stored,
      note: 'Rules are dated. A change is a new record with its own effective date; the earlier table stays so a re-run for an earlier month reproduces the slab that was in force then.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/professional-tax/rules
 *
 * Keys on (state, effectiveFrom). Amending a state is a new record, never an
 * edit of the old one — see the header.
 */
exports.upsertRule = async (req, res, next) => {
  try {
    const state = String(req.body.state || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(state)) {
      return res
        .status(400)
        .json({ message: 'state must be a two or three letter code' });
    }

    const effectiveFrom = new Date(req.body.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      return res.status(422).json({
        message:
          'effectiveFrom is required. A rule with no date cannot be applied to a past month, and a payroll re-run has to reproduce the table that was in force then.',
      });
    }

    const periodicity = req.body.periodicity;
    if (!Object.values(PERIODICITY).includes(periodicity)) {
      return res.status(400).json({ message: 'Unknown periodicity' });
    }

    const slabs = Array.isArray(req.body.slabs) ? req.body.slabs : [];

    if (periodicity !== PERIODICITY.NOT_LEVIED) {
      if (slabs.length === 0) {
        return res
          .status(400)
          .json({ message: 'A levying state needs at least one slab' });
      }

      // The last band has to be open, or a high earner falls off the end of the
      // table and attracts nothing — which reads as an exemption rather than a
      // gap in the rule.
      const last = slabs[slabs.length - 1];
      if (last?.upTo !== null && last?.upTo !== undefined) {
        return res.status(422).json({
          message:
            'The last slab must be open-ended (upTo null). A bounded last band lets a high earner fall off the table and attract nothing.',
        });
      }

      const ordered = slabs.every((slab, index) => {
        if (index === 0) return true;
        const previous = slabs[index - 1];
        if (previous.upTo === null || previous.upTo === undefined) return false;
        return slab.upTo === null || slab.upTo === undefined
          ? true
          : Number(slab.upTo) > Number(previous.upTo);
      });

      if (!ordered) {
        return res
          .status(422)
          .json({ message: 'Slabs must ascend and only the last may be open' });
      }
    }

    const rule = await ProfessionalTaxRule.findOneAndUpdate(
      { tenantId: req.tenantId, state, effectiveFrom },
      {
        $set: {
          name: String(req.body.name || state).trim(),
          periodicity,
          levyLevel: req.body.levyLevel,
          requiresLocalBody: Boolean(req.body.requiresLocalBody),
          localBody: String(req.body.localBody || '').trim(),
          slabs: slabs.map((slab) => ({
            upTo:
              slab.upTo === null || slab.upTo === undefined
                ? null
                : Number(slab.upTo),
            amount: Number(slab.amount) || 0,
          })),
          specialMonth: req.body.specialMonth?.month
            ? {
                month: Number(req.body.specialMonth.month),
                amount: Number(req.body.specialMonth.amount) || 0,
              }
            : undefined,
          enrolmentAnnualAmount: Math.min(
            Number(req.body.enrolmentAnnualAmount) || 0,
            ANNUAL_CEILING,
          ),
          monthlyReturnThreshold: Number(req.body.monthlyReturnThreshold) || 0,
          source: String(req.body.source || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PROFESSIONAL_TAX_RULE_RECORDED',
      resourceType: 'ProfessionalTaxRule',
      resourceIds: [rule._id],
      details: {
        state,
        // The effective date is in the audit line because it decides which
        // months this table reaches. Backdating it silently rewrites the
        // deduction on payslips already issued.
        effectiveFrom,
        periodicity,
        slabCount: rule.slabs.length,
        specialMonth: rule.specialMonth?.month || null,
      },
      req,
    });

    return res.status(201).json({ rule });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/professional-tax/profiles
 */
exports.listProfiles = async (req, res, next) => {
  try {
    const profiles = await ProfessionalTaxProfile.find({
      tenantId: req.tenantId,
    })
      .populate('employeeId', 'name email')
      .sort({ workState: 1 })
      .lean();

    return res.json({ profiles });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/professional-tax/profiles/:employeeId
 *
 * The work state, set explicitly. Never derived from the address — see the
 * header.
 */
exports.upsertProfile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const workState = String(req.body.workState || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(workState)) {
      return res.status(422).json({
        message:
          'workState is required and is the state of the place of work — not the registered office and not the employee’s residence.',
      });
    }

    const category = Object.values(CATEGORY).includes(req.body.category)
      ? req.body.category
      : CATEGORY.DEFAULT;

    const exemptions = Array.isArray(req.body.exemptions)
      ? req.body.exemptions.filter((code) => EXEMPTION[code])
      : [];

    // An exemption is a statutory finding about a person — a disability, a
    // parent of a child with a disability, service in the armed forces. One
    // recorded with no basis is a note, and it is the first thing an inspection
    // asks to see.
    if (
      exemptions.length > 0 &&
      !String(req.body.exemptionBasis || '').trim()
    ) {
      return res.status(422).json({
        message:
          'An exemption needs the basis it rests on. The exemption is a finding about the person and the record has to say what supports it.',
      });
    }

    const profile = await ProfessionalTaxProfile.findOneAndUpdate(
      { tenantId: req.tenantId, employeeId: req.params.employeeId },
      {
        $set: {
          workState,
          localBody: String(req.body.localBody || '').trim(),
          category,
          exemptions,
          exemptionBasis: String(req.body.exemptionBasis || '').trim(),
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PROFESSIONAL_TAX_PROFILE_RECORDED',
      resourceType: 'ProfessionalTaxProfile',
      resourceIds: [profile._id],
      details: {
        employeeId: req.params.employeeId,
        workState,
        category,
        exemptions,
      },
      req,
    });

    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/professional-tax/registrations
 */
exports.listRegistrations = async (req, res, next) => {
  try {
    const registrations = await ProfessionalTaxRegistration.find({
      tenantId: req.tenantId,
    })
      .sort({ state: 1, certificate: 1 })
      .lean();

    return res.json({
      registrations,
      note: 'The enrolment certificate covers the employer’s own tax on the trade it carries on and is deducted from nobody. The registration certificate is the authority to deduct from employees. Two obligations, two returns.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/professional-tax/registrations
 */
exports.upsertRegistration = async (req, res, next) => {
  try {
    const state = String(req.body.state || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(state)) {
      return res.status(400).json({ message: 'state must be a state code' });
    }

    const certificate = req.body.certificate;
    if (!Object.values(CERTIFICATE).includes(certificate)) {
      return res.status(400).json({ message: 'Unknown certificate type' });
    }

    const returnPeriodicity = Object.values(PERIODICITY).includes(
      req.body.returnPeriodicity,
    )
      ? req.body.returnPeriodicity
      : PERIODICITY.MONTHLY;

    const registration = await ProfessionalTaxRegistration.findOneAndUpdate(
      { tenantId: req.tenantId, state, certificate },
      {
        $set: {
          number: String(req.body.number || '').trim(),
          localBody: String(req.body.localBody || '').trim(),
          issuedOn: req.body.issuedOn ? new Date(req.body.issuedOn) : undefined,
          active: req.body.active !== false,
          returnPeriodicity,
          recordedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PROFESSIONAL_TAX_REGISTRATION_RECORDED',
      resourceType: 'ProfessionalTaxRegistration',
      resourceIds: [registration._id],
      details: { state, certificate, returnPeriodicity },
      req,
    });

    return res.status(201).json({ registration });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/professional-tax/payments
 *
 * The date the money reached the state, which is the field section 16(iii)
 * turns on — and it is separate from the period the payment discharges.
 */
exports.recordPayment = async (req, res, next) => {
  try {
    const state = String(req.body.state || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(state)) {
      return res.status(400).json({ message: 'state must be a state code' });
    }

    const paidOn = new Date(req.body.paidOn);
    if (Number.isNaN(paidOn.getTime())) {
      return res.status(400).json({ message: 'paidOn must be a valid date' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ message: 'amount must be a positive number' });
    }

    const payment = await ProfessionalTaxPayment.create({
      tenantId: req.tenantId,
      state,
      certificate: Object.values(CERTIFICATE).includes(req.body.certificate)
        ? req.body.certificate
        : CERTIFICATE.REGISTRATION,
      paidOn,
      periodYear: Number(req.body.periodYear) || undefined,
      periodMonth: Number(req.body.periodMonth) || undefined,
      amount,
      challanReference: String(req.body.challanReference || '').trim(),
      recordedBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PROFESSIONAL_TAX_PAYMENT_RECORDED',
      resourceType: 'ProfessionalTaxPayment',
      resourceIds: [payment._id],
      details: {
        state,
        amount,
        // Both dates, because they can be in different financial years and the
        // section 16(iii) deduction follows the first rather than the second.
        paidOn,
        period:
          payment.periodYear && payment.periodMonth
            ? `${payment.periodYear}-${String(payment.periodMonth).padStart(2, '0')}`
            : '',
      },
      req,
    });

    return res.status(201).json({ payment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/professional-tax/assessment
 */
exports.getAssessment = async (req, res, next) => {
  try {
    const financialYear =
      Number(req.query.financialYear) || financialYearOf(new Date());

    const { result, profileCount } = await computeYear({
      tenantId: req.tenantId,
      financialYear,
    });

    return res.json({
      financialYear,
      profileCount,
      result,
      note: 'One remittance per registration certificate. There is no total across states — a company with offices in two states remits to two authorities on two schedules, and a combined figure is not a number anyone can pay.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/professional-tax/section-16iii
 *
 * What the salary computation may deduct. Reads the payments and deliberately
 * not the accruals — see the header.
 */
exports.getSection16iii = async (req, res, next) => {
  try {
    const financialYear =
      Number(req.query.financialYear) || financialYearOf(new Date());

    const { result } = await computeYear({
      tenantId: req.tenantId,
      financialYear,
    });

    return res.json({
      financialYear,
      /** Allowable. Actually paid inside the year. */
      paidForSection16iii: result.paidForSection16iii,
      /** Not allowable this year, whatever was deducted from the employee. */
      accruedNotPaid: Math.max(0, result.accrued - result.paidForSection16iii),
      note: 'Section 16(iii) allows professional tax actually paid. An amount deducted in March and remitted in April is allowable in the following year, not this one.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/professional-tax/assessments
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await ProfessionalTaxAssessment.find({
      tenantId: req.tenantId,
    })
      .sort({ financialYear: -1 })
      .limit(20)
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/professional-tax/assessments
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const financialYear =
      Number(req.body.financialYear) || financialYearOf(new Date());

    const { result, ruleSets, profileCount } = await computeYear({
      tenantId: req.tenantId,
      financialYear,
    });

    if (profileCount === 0) {
      return res.status(422).json({
        message:
          'No employee has a work state recorded. An assessment over nobody would read as a nil liability rather than as an unconfigured module.',
      });
    }

    const assessment = await ProfessionalTaxAssessment.findOneAndUpdate(
      { tenantId: req.tenantId, financialYear },
      {
        $set: {
          registrations: result.registrations,
          accrued: result.accrued,
          paidForSection16iii: result.paidForSection16iii,
          rulesSnapshot: ruleSets,
          findings: result.findings,
          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PROFESSIONAL_TAX_ASSESSMENT_COMMITTED',
      resourceType: 'ProfessionalTaxAssessment',
      resourceIds: [assessment._id],
      details: {
        financialYear,
        // Per state, because that is the certificate the money is remitted
        // under. An audit line carrying one national total would be a figure
        // nobody can reconcile to a challan.
        states: result.registrations.map((row) => ({
          state: row.state,
          deducted: row.deductedFromEmployees,
        })),
        paidForSection16iii: result.paidForSection16iii,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};
