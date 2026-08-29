const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { generateForecast, getForecasts, getForecastById } = require('../controllers/forecast.controller');

const router = express.Router();

router.post('/generate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateForecast);
router.get('/', auth, requirePermission('READ_PAYROLL'), getForecasts);
router.get('/:id', auth, requirePermission('READ_PAYROLL'), getForecastById);

module.exports = router;
