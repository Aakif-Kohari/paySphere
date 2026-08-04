const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.post('/', workflowController.createWorkflow);
router.get('/', workflowController.getWorkflows);
router.post('/:instanceId/transition', workflowController.transitionInstance);

module.exports = router;
