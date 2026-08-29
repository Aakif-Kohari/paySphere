const express = require('express');
const {
  submitPayrollForReview,
  getPayrollSummary,
} = require('../controllers/payroll.controller');
const auth = require('../middlewares/auth.middleware');
const { requireScope } = require('../middlewares/rbac.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const idempotencyMiddleware = require('../middlewares/idempotency.middleware');
const { payrollFinalizeSchema } = require('../validations/schemas');
const router = express.Router();

router.post(
  '/finalize',
  auth,
  requireScope('payroll:write'),
  validateRequest(payrollFinalizeSchema),
  idempotencyMiddleware,
  submitPayrollForReview,
);
router.get('/summary', auth, requireScope('payroll:read'), getPayrollSummary);
router.post('/payroll/:payrollId/generate-payslips', authMiddleware, rbacMiddleware, payrollController.generatePayslips);
router.get('/payslip/:jobHash/status', authMiddleware, payrollController.getPayslipStatus);
module.exports = router;
