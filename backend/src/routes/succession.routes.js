const express = require('express');
const router = express.Router();
const controller = require('../controllers/succession.controller');

router.get('/roles', controller.getRoles);
router.get('/candidates', controller.getCandidates);
router.get('/topology', controller.getTopology);
router.post('/seed', controller.seedSuccessionData);

module.exports = router;
