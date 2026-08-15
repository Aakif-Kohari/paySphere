/**
 * @fileoverview POSH Grievance Controller
 * @description Handles anonymous filing, ICC case management, and encrypted note logging.
 * Issue: #958
 */
const bcrypt = require('bcryptjs');
const { Grievance, ICCCommittee } = require('../models/grievance.model');
const {
  encrypt,
  decrypt,
  generateCaseNumber,
} = require('../utils/cryptoAnonymizer');
const { tenantFilter } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/grievances/file (Public / Authenticated)
 * Allows an employee (or anonymous user) to file a POSH complaint.
 */
exports.fileGrievance = async (req, res, next) => {
  try {
    const { respondentId, incidentDate, description, isAnonymous } = req.body;

    // Count existing cases this year to generate sequential case number
    const currentYear = new Date().getFullYear();
    const yearCount = await Grievance.countDocuments({
      tenantId: req.tenantId,
      filedAt: { $gte: new Date(`${currentYear}-01-01`) },
    });

    const caseNumber = generateCaseNumber(yearCount);
    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + 90); // 90-day statutory limit

    // Encrypt the sensitive description
    const { encrypted, iv, authTag } = encrypt(description);

    const grievance = await Grievance.create({
      tenantId: req.tenantId,
      caseNumber,
      complainantId: isAnonymous ? null : req.userId, // Nullify if anonymous
      respondentId: respondentId || null,
      incidentDate: new Date(incidentDate),
      encryptedDescription: `${encrypted}:${authTag}`, // Store auth tag with ciphertext
      encryptionIV: iv,
      slaDeadline,
    });

    // Emit strict audit log (does NOT include the description)
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId || 'anonymous',
      action: 'POSH_GRIEVANCE_FILED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: { caseNumber, isAnonymous: !!isAnonymous },
      req,
    });

    res.status(201).json({
      message:
        'Grievance filed securely. The ICC will review this within the statutory 90-day period.',
      caseNumber,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grievances/cases (ICC Only)
 * Fetches all cases for the tenant. Descriptions remain encrypted until explicitly requested.
 */
exports.getCases = async (req, res, next) => {
  try {
    const cases = await Grievance.find({ tenantId: req.tenantId })
      .select('-encryptedDescription -encryptionIV') // Do not send encrypted blobs in list view
      .populate('respondentId', 'fullName department')
      .sort({ filedAt: -1 })
      .lean();

    // Check for SLA breaches
    const now = new Date();
    const casesWithSLA = cases.map((c) => ({
      ...c,
      isSLABreached:
        c.status !== 'Resolved' &&
        c.status !== 'Dismissed' &&
        now > c.slaDeadline,
      daysRemaining: Math.ceil((c.slaDeadline - now) / (1000 * 60 * 60 * 24)),
    }));

    res.status(200).json({ cases: casesWithSLA });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/grievances/:id/decrypt (ICC Only)
 * Decrypts and returns the case description. Requires secondary PIN verification.
 */
exports.decryptCase = async (req, res, next) => {
  try {
    const { pin } = req.body;

    // Scoped, not `findById` (#1010).
    //
    // `requireICC` on the route already establishes that the caller is an
    // active committee member *of their own tenant*, and it does that
    // correctly. What it cannot do is constrain which case they then name:
    // the id comes from the URL. So an ICC member at company A could pass
    // the id of company B's case and this handler would fetch it, and —
    // because `cryptoAnonymizer` derives its key from a single
    // `POSH_MASTER_KEY` rather than per tenant — decrypt it cleanly.
    //
    // Putting the tenant in the query makes the row unfetchable rather
    // than merely unreturned, and `tenantFilter` throws (403) rather than
    // degrading to `{}` if the request somehow has no tenant.
    const grievance = await Grievance.findOne(
      tenantFilter(req, { _id: req.params.id }),
    );

    if (!grievance) return res.status(404).json({ message: 'Case not found' });

    // The secondary PIN, which was never actually checked.
    //
    // The previous version fetched `iccMember` and then did nothing with
    // it — the comparison lived in a comment reading "in a real app,
    // compare `pin` against `iccMember.decryptionPinHash` using bcrypt".
    // So the second factor this endpoint advertises did not exist, and a
    // committee member's session token alone was enough to read every
    // complaint in the company. For a statutory confidential-complaints
    // mechanism that second factor is the point: it is what stops a
    // borrowed or hijacked session from being enough.
    const iccMember = await ICCCommittee.findOne(
      tenantFilter(req, { userId: req.userId, isActive: true }),
    );

    if (!iccMember) {
      // `requireICC` should have caught this already. Checked again
      // because the cost is one indexed lookup we were making anyway,
      // and the failure mode if the guard is ever dropped from the route
      // is silent and total.
      logger.warn('POSH decryption attempted by a non-ICC account', {
        userId: req.userId,
        caseNumber: grievance.caseNumber,
      });

      return res.status(403).json({
        message:
          'Forbidden: Access restricted to Internal Complaints Committee (ICC) members only.',
      });
    }

    const pinAccepted =
      typeof pin === 'string' &&
      pin.length > 0 &&
      (await bcrypt.compare(pin, iccMember.decryptionPinHash));

    if (!pinAccepted) {
      // A refused decryption is recorded as loudly as a successful one.
      // Repeated failures against one case are the signal that somebody
      // is guessing, and an audit trail that only records successes
      // cannot show that.
      eventBus.emit('AUDIT_LOG', {
        userId: req.userId,
        action: 'POSH_CASE_DECRYPT_DENIED',
        resourceType: 'Grievance',
        resourceIds: [grievance._id],
        details: {
          caseNumber: grievance.caseNumber,
          iccRole: req.iccRole,
          reason: 'invalid_pin',
        },
        req,
      });

      return res.status(403).json({ message: 'Invalid decryption PIN' });
    }

    const [encrypted, authTag] = grievance.encryptedDescription.split(':');
    const decryptedText = decrypt(encrypted, grievance.encryptionIV, authTag);

    // Log the decryption event for tamper-proof audit
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'POSH_CASE_DECRYPTED',
      resourceType: 'Grievance',
      resourceIds: [grievance._id],
      details: { caseNumber: grievance.caseNumber, iccRole: req.iccRole },
      req,
    });

    res
      .status(200)
      .json({ caseNumber: grievance.caseNumber, description: decryptedText });
  } catch (error) {
    next(error);
  }
};
