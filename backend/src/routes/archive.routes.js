const express = require('express');
const router = express.Router();
const { getArchivedEmployees } = require('../controllers/archive.controller');
const { auth } = require('../middlewares/auth.middleware');

router.get('/employees', auth, getArchivedEmployees);

module.exports = router;
