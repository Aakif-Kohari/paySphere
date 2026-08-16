/**
 * @fileoverview ESOP scheme, grant, vesting and exercise endpoints.
 * @description Issue: #1073
 *
 * Every handler is tenant-scoped on the way in — `tenantId: req.tenantId` is in
 * the filter of every query, not applied afterwards — which is the shape #1010
 * settled on after the cross-tenant IDOR it found. Fetching first and checking
 * ownership second leaks existence through the 404-vs-403 distinction, and is
 * one refactor away from not checking at all.
 */

const mongoose = require('mongoose');

const { EsopScheme, EsopGrant, EsopExercise } = require('../models/esop.model');
const Employee = require('../models/employee.model');
const {
  buildVestingSchedule,
  vestedAsOf,
  computePerquisite,
  computeForfeitureOnExit,
  summarisePool,
  canGrant,
  normaliseTerms,
  GRANT_STATUS,
} = require('../utils/vestingCalculator');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * Resolve a date the caller supplied, falling back to now.
 *
 * Handlers take `asOf` from the query string so a schedule can be projected
 * ("what will have vested by 31 March") without a clock in the calculator. An
 * unparseable value falls back rather than producing an Invalid Date that
 * compares false against everything and silently reports zero vested.
 *
 * @param {string|undefined} raw
 * @returns {Date}
 */
function resolveAsOf(raw) {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * POST /api/esop/schemes
 */
exports.createScheme = async (req, res, next) => {
  try {
    const {
      name,
      authorisedPool,
      currency,
      defaultCliffMonths,
      defaultVestingDurationMonths,
      defaultVestingFrequency,
      postTerminationExerciseWindowDays,
    } = req.body;

    if (!name || !authorisedPool) {
      return res
        .status(400)
        .json({ message: 'name and authorisedPool are required' });
    }

    const scheme = await EsopScheme.create({
      tenantId: req.tenantId,
      name,
      authorisedPool,
      currency,
      defaultCliffMonths,
      defaultVestingDurationMonths,
      defaultVestingFrequency,
      postTerminationExerciseWindowDays,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESOP_SCHEME_CREATED',
      resourceType: 'EsopScheme',
      resourceIds: [scheme._id],
      details: { name, authorisedPool },
      req,
    });

    return res.status(201).json({ message: 'Scheme created', scheme });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A scheme with that name already exists' });
    }
    return next(error);
  }
};

/**
 * GET /api/esop/schemes
 *
 * Returns each scheme with its pool position, because a scheme without one is
 * not useful to anybody — the first question about a scheme is always how much
 * of it is left.
 */
exports.getSchemes = async (req, res, next) => {
  try {
    const schemes = await EsopScheme.find({ tenantId: req.tenantId }).lean();
    const grants = await EsopGrant.find({ tenantId: req.tenantId })
      .select('schemeId optionsGranted optionsExercised optionsForfeited')
      .lean();

    const byScheme = new Map();
    for (const grant of grants) {
      const key = String(grant.schemeId);
      if (!byScheme.has(key)) byScheme.set(key, []);
      byScheme.get(key).push(grant);
    }

    const withPool = schemes.map((scheme) => ({
      ...scheme,
      pool: summarisePool(scheme, byScheme.get(String(scheme._id)) || []),
    }));

    return res.json({ schemes: withPool });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/esop/grants
 *
 * The pool check is the reason this handler is not a bare `create`. Granting
 * past the authorised pool means the company has promised more equity than the
 * board approved, which is a governance failure rather than a validation nicety.
 */
exports.createGrant = async (req, res, next) => {
  try {
    const {
      schemeId,
      employeeId,
      grantReference,
      optionsGranted,
      exercisePrice,
      grantDate,
      vestingStartDate,
      cliffMonths,
      vestingDurationMonths,
      vestingFrequency,
      notes,
    } = req.body;

    if (
      !mongoose.isValidObjectId(schemeId) ||
      !mongoose.isValidObjectId(employeeId)
    ) {
      return res
        .status(400)
        .json({ message: 'schemeId and employeeId must be valid ids' });
    }

    const scheme = await EsopScheme.findOne({
      _id: schemeId,
      tenantId: req.tenantId,
    });
    if (!scheme) return res.status(404).json({ message: 'Scheme not found' });
    if (!scheme.isActive) {
      return res
        .status(409)
        .json({ message: 'Scheme is closed to new grants' });
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId: req.tenantId,
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    const siblings = await EsopGrant.find({
      tenantId: req.tenantId,
      schemeId,
    })
      .select('optionsGranted optionsExercised optionsForfeited')
      .lean();

    const capacity = canGrant(scheme, siblings, optionsGranted);
    if (!capacity.allowed) {
      return res
        .status(409)
        .json({ message: capacity.reason, pool: capacity.pool });
    }

    // Vesting terms fall back to the scheme's defaults, then are validated as a
    // set. A 24-month cliff on an 18-month schedule is two individually valid
    // numbers describing a grant that never vests, and only the combination
    // shows that.
    const terms = {
      optionsGranted,
      grantDate,
      vestingStartDate: vestingStartDate || grantDate,
      cliffMonths: cliffMonths ?? scheme.defaultCliffMonths,
      vestingDurationMonths:
        vestingDurationMonths ?? scheme.defaultVestingDurationMonths,
      vestingFrequency: vestingFrequency || scheme.defaultVestingFrequency,
    };

    const validation = normaliseTerms(terms);
    if (!validation.valid) {
      return res
        .status(400)
        .json({ message: 'Invalid vesting terms', errors: validation.errors });
    }

    const grant = await EsopGrant.create({
      tenantId: req.tenantId,
      schemeId,
      employeeId,
      grantReference,
      optionsGranted,
      exercisePrice,
      grantDate: new Date(grantDate),
      vestingStartDate: new Date(terms.vestingStartDate),
      cliffMonths: terms.cliffMonths,
      vestingDurationMonths: terms.vestingDurationMonths,
      vestingFrequency: terms.vestingFrequency,
      notes,
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESOP_GRANT_ISSUED',
      resourceType: 'EsopGrant',
      resourceIds: [grant._id],
      details: { employeeId, optionsGranted, exercisePrice, grantReference },
      req,
    });

    return res.status(201).json({ message: 'Grant issued', grant });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'That grant reference is already in use' });
    }
    return next(error);
  }
};

/**
 * GET /api/esop/grants
 */
exports.getGrants = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (
      req.query.employeeId &&
      mongoose.isValidObjectId(req.query.employeeId)
    ) {
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.status) filter.status = req.query.status;

    const asOf = resolveAsOf(req.query.asOf);
    const grants = await EsopGrant.find(filter)
      .populate('employeeId', 'fullName email department')
      .lean();

    return res.json({
      asOf,
      grants: grants.map((grant) => ({
        ...grant,
        position: vestedAsOf(grant, asOf),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/esop/grants/:id/schedule
 */
exports.getVestingSchedule = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid grant id' });
    }

    const grant = await EsopGrant.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();
    if (!grant) return res.status(404).json({ message: 'Grant not found' });

    const schedule = buildVestingSchedule(grant);
    if (!schedule.valid) {
      // Stored terms that no longer produce a schedule are a data problem, not
      // a client one — a 500 would be wrong, and so would pretending the grant
      // vests nothing.
      logger.error('Stored grant has unusable vesting terms', {
        grantId: String(grant._id),
        errors: schedule.errors,
      });
      return res
        .status(422)
        .json({
          message: 'Grant has unusable vesting terms',
          errors: schedule.errors,
        });
    }

    const asOf = resolveAsOf(req.query.asOf);

    return res.json({
      grant: {
        id: grant._id,
        grantReference: grant.grantReference,
        optionsGranted: grant.optionsGranted,
        exercisePrice: grant.exercisePrice,
      },
      position: vestedAsOf(grant, asOf),
      tranches: schedule.tranches,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/esop/grants/:id/exercise
 *
 * The three refusals here are the whole point of the endpoint:
 *
 *   - exercising more than has vested,
 *   - exercising against a forfeited grant,
 *   - exercising after the post-termination window has closed.
 *
 * Each is checked against the schedule recomputed on the spot rather than
 * against a stored counter, so a grant whose terms were corrected produces the
 * corrected answer.
 */
exports.exerciseOptions = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid grant id' });
    }

    const { optionsToExercise, fmvPerShare, exerciseDate, taxRatePercent } =
      req.body;

    const options = Math.floor(Number(optionsToExercise) || 0);
    if (options <= 0) {
      return res
        .status(400)
        .json({ message: 'optionsToExercise must be a positive whole number' });
    }
    if (fmvPerShare === undefined || Number(fmvPerShare) < 0) {
      return res
        .status(400)
        .json({ message: 'fmvPerShare is required and cannot be negative' });
    }

    const grant = await EsopGrant.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!grant) return res.status(404).json({ message: 'Grant not found' });

    if (
      grant.status === GRANT_STATUS.FORFEITED ||
      grant.status === GRANT_STATUS.LAPSED
    ) {
      return res
        .status(409)
        .json({
          message: `Grant is ${grant.status.toLowerCase()} and cannot be exercised`,
        });
    }

    const when = resolveAsOf(exerciseDate);

    if (
      grant.exerciseWindowClosesOn &&
      when.getTime() > new Date(grant.exerciseWindowClosesOn).getTime()
    ) {
      return res.status(409).json({
        message:
          'The post-termination exercise window for this grant has closed',
        closedOn: grant.exerciseWindowClosesOn,
      });
    }

    const position = vestedAsOf(grant, when);
    if (options > position.exercisable) {
      return res.status(400).json({
        message: `Only ${position.exercisable} options are exercisable as of ${when.toISOString().slice(0, 10)}`,
        vested: position.vested,
        alreadyExercised: position.exercised,
      });
    }

    const valuation = computePerquisite({
      optionsExercised: options,
      fmvPerShare,
      exercisePrice: grant.exercisePrice,
      taxRatePercent,
    });

    const exercise = await EsopExercise.create({
      tenantId: req.tenantId,
      grantId: grant._id,
      employeeId: grant.employeeId,
      exerciseDate: when,
      optionsExercised: options,
      fmvPerShare: valuation.fmvPerShare,
      exercisePrice: valuation.exercisePrice,
      perquisiteValue: valuation.perquisiteValue,
      taxRatePercent: valuation.taxRatePercent,
      tdsWithheld: valuation.tdsWithheld,
      exerciseCost: valuation.exerciseCost,
      capitalGainsCostBasis: valuation.capitalGainsCostBasis,
      recordedBy: req.userId,
    });

    grant.optionsExercised += options;
    if (
      grant.optionsExercised >=
      grant.optionsGranted - grant.optionsForfeited
    ) {
      grant.status = GRANT_STATUS.FULLY_EXERCISED;
    }
    await grant.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESOP_OPTIONS_EXERCISED',
      resourceType: 'EsopGrant',
      resourceIds: [grant._id],
      details: {
        options,
        perquisiteValue: valuation.perquisiteValue,
        tdsWithheld: valuation.tdsWithheld,
      },
      req,
    });

    return res.status(201).json({
      message: 'Exercise recorded',
      exercise,
      valuation,
      grantStatus: grant.status,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/esop/grants/:id/forfeit
 *
 * Called when the holder separates. Unvested options lapse; vested ones survive
 * for the scheme's post-termination window, and the deadline is written onto
 * the grant so `exerciseOptions` above can enforce it without re-deriving it.
 */
exports.forfeitGrant = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid grant id' });
    }

    const grant = await EsopGrant.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!grant) return res.status(404).json({ message: 'Grant not found' });

    if (grant.status !== GRANT_STATUS.ACTIVE) {
      return res
        .status(409)
        .json({ message: `Grant is already ${grant.status.toLowerCase()}` });
    }

    const scheme = await EsopScheme.findOne({
      _id: grant.schemeId,
      tenantId: req.tenantId,
    }).lean();

    const exitDate = resolveAsOf(req.body.exitDate);
    const windowDays =
      req.body.exerciseWindowDays ??
      scheme?.postTerminationExerciseWindowDays ??
      90;

    const outcome = computeForfeitureOnExit(grant, exitDate, windowDays);
    if (!outcome.valid) {
      return res
        .status(422)
        .json({
          message: 'Grant has unusable vesting terms',
          errors: outcome.errors,
        });
    }

    grant.optionsForfeited = outcome.optionsForfeited;
    grant.forfeitedOn = outcome.exitDate;
    grant.exerciseWindowClosesOn = outcome.exerciseWindowClosesOn;
    grant.status = outcome.resultingStatus;
    await grant.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'ESOP_GRANT_FORFEITED',
      resourceType: 'EsopGrant',
      resourceIds: [grant._id],
      details: {
        forfeited: outcome.optionsForfeited,
        retained: outcome.optionsRetained,
        windowClosesOn: outcome.exerciseWindowClosesOn,
      },
      req,
    });

    return res.json({ message: 'Forfeiture recorded', outcome, grant });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/esop/my-grants
 *
 * Self-service. The employee is resolved from `req.userId`, never from a
 * parameter — the whole point of a self-service route is that it cannot be
 * pointed at a colleague.
 */
exports.getMyGrants = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      userId: req.userId,
      tenantId: req.tenantId,
    })
      .select('_id fullName')
      .lean();

    if (!employee) {
      return res
        .status(404)
        .json({ message: 'No employee record is linked to this account' });
    }

    const asOf = resolveAsOf(req.query.asOf);
    const grants = await EsopGrant.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    }).lean();

    const exercises = await EsopExercise.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    })
      .sort({ exerciseDate: -1 })
      .lean();

    const positions = grants.map((grant) => ({
      grantReference: grant.grantReference,
      optionsGranted: grant.optionsGranted,
      exercisePrice: grant.exercisePrice,
      status: grant.status,
      exerciseWindowClosesOn: grant.exerciseWindowClosesOn,
      position: vestedAsOf(grant, asOf),
    }));

    return res.json({
      asOf,
      employee: { id: employee._id, fullName: employee.fullName },
      grants: positions,
      exercises,
      totals: {
        vested: positions.reduce((sum, g) => sum + g.position.vested, 0),
        unvested: positions.reduce((sum, g) => sum + g.position.unvested, 0),
        exercisable: positions.reduce(
          (sum, g) => sum + g.position.exercisable,
          0,
        ),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports._internals = { resolveAsOf };
