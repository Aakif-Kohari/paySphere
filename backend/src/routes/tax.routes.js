const express = require('express');
const router = express.Router();
const taxController = require('../controllers/tax.controller');

router.get('/jurisdictions', taxController.getJurisdictions);
router.get('/obligations', taxController.getObligations);
router.get('/topology', taxController.getRiskTopology);
router.post('/seed', taxController.seedTaxData);

module.exports = router;
