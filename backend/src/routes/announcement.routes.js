const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
} = require('../controllers/announcement.controller');

router.post('/', auth, writeRateLimiter, createAnnouncement);
router.get('/', auth, getAnnouncements);
router.delete('/:id', auth, writeRateLimiter, deleteAnnouncement);

module.exports = router;
