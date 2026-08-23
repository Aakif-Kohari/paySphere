const express = require('express');
const router = express.Router();
const fbpController = require('../controllers/fbp.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware.verifyToken);

// Admin routes
router.post(
  '/admin/windows',
  roleMiddleware.requireRole(['admin', 'hr']),
  fbpController.createWindow,
);
router.put(
  '/admin/declarations/:declarationId/approve',
  roleMiddleware.requireRole(['admin', 'hr']),
  fbpController.approveDeclaration,
);
router.put(
  '/admin/declarations/:declarationId/reject',
  roleMiddleware.requireRole(['admin', 'hr']),
  fbpController.rejectDeclaration,
);

// Employee routes
router.get('/windows', fbpController.getOpenWindows);
router.post('/employees/:employeeId/simulate', fbpController.simulateTaxImpact);
router.post('/employees/:employeeId/declare', fbpController.submitDeclaration);

module.exports = router;
