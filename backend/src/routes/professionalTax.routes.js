const express = require('express');

const {
  listRules,
  upsertRule,
  listProfiles,
  upsertProfile,
  listRegistrations,
  upsertRegistration,
  recordPayment,
  getAssessment,
  getSection16iii,
  listAssessments,
  commitAssessment,
} = require('../controllers/professionalTax.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Professional tax, Article 276 and the state enactments (#1876) --------
//
// Three permissions, and the split is on which name can change what a payslip
// already issued says.
//
// Recording a work state, a registration certificate and a remittance is
// administration and sits under MANAGE_PROFESSIONAL_TAX. Every figure it writes
// is checkable against a certificate or a challan.
//
// Writing a slab table is not. A rule carries an effective date, and backdating
// one silently rewrites the deduction on payslips already issued — the
// employee's copy and ours would then disagree with nothing having failed. It
// sits behind MANAGE_PT_RULE, and whoever holds it does not also record the
// remittances that are reconciled against the result.
//
// Committing the year's assessment is in the same bracket, because it fixes the
// section 16(iii) figure the salary computation will deduct and therefore the
// TDS in Form 24Q.
//
// Deliberately not the payroll permissions, though the deduction lands on a
// payslip. A payroll permission decides what an employee is paid; these decide
// what a state is owed, and the two are answerable to different people.

router.get(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.READ_PROFESSIONAL_TAX),
  listRules,
);

// The effective date is the dangerous field here — see the note above.
router.post(
  '/rules',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PT_RULE),
  writeRateLimiter,
  upsertRule,
);

router.get(
  '/profiles',
  auth,
  requirePermission(PERMISSIONS.READ_PROFESSIONAL_TAX),
  listProfiles,
);

router.put(
  '/profiles/:employeeId',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PROFESSIONAL_TAX),
  writeRateLimiter,
  upsertProfile,
);

router.get(
  '/registrations',
  auth,
  requirePermission(PERMISSIONS.READ_PROFESSIONAL_TAX),
  listRegistrations,
);

router.post(
  '/registrations',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PROFESSIONAL_TAX),
  writeRateLimiter,
  upsertRegistration,
);

router.post(
  '/payments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PROFESSIONAL_TAX),
  writeRateLimiter,
  recordPayment,
);

// Read-only. It computes and returns; nothing is written by looking at it.
router.get(
  '/assessment',
  auth,
  requirePermission(PERMISSIONS.READ_PROFESSIONAL_TAX),
  getAssessment,
);

// What the salary computation may deduct. Reads the payments and not the
// accruals: section 16(iii) allows professional tax actually paid.
router.get(
  '/section-16iii',
  auth,
  requirePermission(PERMISSIONS.READ_PROFESSIONAL_TAX),
  getSection16iii,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_PROFESSIONAL_TAX),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PT_RULE),
  writeRateLimiter,
  commitAssessment,
);

module.exports = router;
