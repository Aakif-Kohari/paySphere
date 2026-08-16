const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { getReconciliationReport } = require('../controllers/forex.controller');

router.get('/reconciliation', auth, getReconciliationReport);

module.exports = router;
