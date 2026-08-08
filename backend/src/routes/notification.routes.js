const express = require("express");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notification.controller");
const auth = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", auth, getNotifications);
router.patch("/:id/read", auth, markAsRead);
router.patch("/read-all", auth, markAllAsRead);

module.exports = router;
