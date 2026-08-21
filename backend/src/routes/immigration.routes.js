const express = require('express');
const router = express.Router();
const controller = require('../controllers/immigration.controller');

router.get('/workers', controller.getWorkers);
router.get('/sponsorships', controller.getSponsorships);
router.get('/risk-chart', controller.getRiskChart);
router.post('/seed', controller.seedImmigrationData);

module.exports = router;
