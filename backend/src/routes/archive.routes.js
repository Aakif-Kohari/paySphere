const express = require('express');
const router = express.Router();
const { getArchivedEmployees } = require('../controllers/archive.controller');
// `auth.middleware` exports the middleware itself (`module.exports = auth`),
// not an object containing it. Destructuring gave `undefined`, and
// `router.get(path, undefined, handler)` throws at require time — so simply
// mounting this router was enough to stop the server booting. Same shape as
// the `verifyToken` destructure that broke #614.
const auth = require('../middlewares/auth.middleware');

router.get('/employees', auth, getArchivedEmployees);

module.exports = router;
