const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  createPYQ,
  bulkUploadPYQs,
  getPYQs,
  generateTrendForecast,
  getLatestTrendForecast,
} = require("../controllers/pyq.controller");

router.post("/", auth, createPYQ);
router.post("/bulk", auth, bulkUploadPYQs);
router.get("/", auth, getPYQs);
router.post("/forecast", auth, generateTrendForecast);
router.get("/forecast", auth, getLatestTrendForecast);

module.exports = router;
