const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  createDeck,
  getMyDecks,
  updateDeck,
  deleteDeck,
  getCommunityDecks,
  cloneDeck,
} = require("../controllers/flashcard.controller");

router.post("/", auth, createDeck);
router.get("/my-decks", auth, getMyDecks);
router.put("/:id", auth, updateDeck);
router.delete("/:id", auth, deleteDeck);
router.get("/community", auth, getCommunityDecks);
router.post("/clone/:id", auth, cloneDeck);

module.exports = router;
