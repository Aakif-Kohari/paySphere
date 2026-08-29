const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { addVehicle, getFleet, assignVehicle, logTrip, getTripLogs } = require('../controllers/fleet.controller');

const router = express.Router();

router.post('/vehicles', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, addVehicle);
router.get('/vehicles', auth, requirePermission('READ_EMPLOYEE'), getFleet);
router.post('/vehicles/assign', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, assignVehicle);

router.post('/trips', auth, writeRateLimiter, logTrip);
router.get('/trips', auth, getTripLogs);

module.exports = router;
