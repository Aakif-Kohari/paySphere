const FlashcardDeck = require('../models/flashcardDeck.model');
const { tenantFilter } = require('../utils/tenantScope');
const { generateSummaryTags } = require('../utils/gemini');

// Create a new flashcard deck
exports.createDeck = async (req, res, next) => {
  try {
    const { title, description, subject, exam, isPublic, cards } = req.body;

    if (!title || !subject || !exam || !cards) {
      return res
        .status(400)
        .json({
          message:
            'Missing required fields: title, subject, exam, and cards are required',
        });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res
        .status(400)
        .json({ message: 'A flashcard deck must have at least one card' });
    }

    const filter = tenantFilter(req);

    // Generate AI summary tags if deck is set to public
    let tags = [];
    if (isPublic) {
      tags = await generateSummaryTags({
        title,
        description,
        subject,
        exam,
        cards,
      });
    }

    const newDeck = await FlashcardDeck.create({
      title,
      description,
      subject,
      exam,
      isPublic: !!isPublic,
      cards,
      tags,
      createdBy: req.userId,
      tenantId: filter.tenantId,
    });

    res.status(201).json(newDeck);
  } catch (error) {
    next(error);
  }
};

// Retrieve authenticated user's flashcard decks (custom and cloned)
exports.getMyDecks = async (req, res, next) => {
  try {
    const filter = tenantFilter(req, { createdBy: req.userId });
    const decks = await FlashcardDeck.find(filter).sort({ createdAt: -1 });
    res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
};

// Update an existing deck details/cards
exports.updateDeck = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, subject, exam, isPublic, cards } = req.body;

    const deck = await FlashcardDeck.findOne({
      _id: id,
      createdBy: req.userId,
    });
    if (!deck) {
      return res
        .status(404)
        .json({ message: 'Flashcard deck not found or unauthorized' });
    }

    if (title) deck.title = title;
    if (description !== undefined) deck.description = description;
    if (subject) deck.subject = subject;
    if (exam) deck.exam = exam;
    if (cards) {
      if (!Array.isArray(cards) || cards.length === 0) {
        return res
          .status(400)
          .json({ message: 'A flashcard deck must have at least one card' });
      }
      deck.cards = cards;
    }

    // Determine if we should generate or re-generate tags
    const prevPublic = deck.isPublic;
    if (isPublic !== undefined) {
      deck.isPublic = !!isPublic;
    }

    // Re-generate tags if it became public, or if it is public and cards/metadata changed
    if (deck.isPublic && (!prevPublic || cards || title || subject || exam)) {
      deck.tags = await generateSummaryTags({
        title: deck.title,
        description: deck.description,
        subject: deck.subject,
        exam: deck.exam,
        cards: deck.cards,
      });
    } else if (!deck.isPublic) {
      deck.tags = [];
    }

    await deck.save();
    res.status(200).json(deck);
  } catch (error) {
    next(error);
  }
};

// Delete a deck
exports.deleteDeck = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deck = await FlashcardDeck.findOneAndDelete({
      _id: id,
      createdBy: req.userId,
    });
    if (!deck) {
      return res
        .status(404)
        .json({ message: 'Flashcard deck not found or unauthorized' });
    }
    res.status(200).json({ message: 'Flashcard deck deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Retrieve community public decks with search, filters, and pagination
exports.getCommunityDecks = async (req, res, next) => {
  try {
    // Public browsing still requires authentication, so we have req.userId
    if (!req.userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const { subject, exam, minRating, search } = req.query;

    const query = { isPublic: true };

    if (subject) {
      query.subject = new RegExp(subject.trim(), 'i');
    }

    if (exam) {
      query.exam = new RegExp(exam.trim(), 'i');
    }

    if (minRating) {
      const parsedRating = parseFloat(minRating);
      if (!isNaN(parsedRating)) {
        query.rating = { $gte: parsedRating };
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ];
    }

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 12;

    const skip = (page - 1) * limit;

    const [decks, totalDecks] = await Promise.all([
      FlashcardDeck.find(query)
        .sort({ downloadsCount: -1, rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FlashcardDeck.countDocuments(query),
    ]);

    res.status(200).json({
      decks,
      totalPages: Math.ceil(totalDecks / limit) || 1,
      currentPage: page,
      totalDecks,
    });
  } catch (error) {
    next(error);
  }
};

// Clone a public deck into the authenticated user's own library
exports.cloneDeck = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filter = tenantFilter(req);

    // `filter` was computed on the line above and then not used — the fetch
    // went through `findById`, so a deck belonging to another company was
    // clonable by id (#1010). Every other handler in this file scopes
    // correctly; this one built the filter and dropped it.
    //
    // The `isPublic` check below is not a substitute. "Public" means visible
    // within the company, not across companies — nothing in the product offers
    // a cross-tenant deck library.
    const originalDeck = await FlashcardDeck.findOne({ ...filter, _id: id });
    if (!originalDeck) {
      return res
        .status(404)
        .json({ message: 'Original flashcard deck not found' });
    }

    if (!originalDeck.isPublic) {
      return res
        .status(403)
        .json({ message: 'Cannot clone private flashcard decks' });
    }

    // Increment downloads count on the original deck
    originalDeck.downloadsCount += 1;
    await originalDeck.save();

    // Create cloned deck in the user's library
    const clonedDeck = await FlashcardDeck.create({
      title: `${originalDeck.title} (Cloned)`,
      description: originalDeck.description,
      subject: originalDeck.subject,
      exam: originalDeck.exam,
      isPublic: false, // cloned decks default to private in library
      cards: originalDeck.cards.map((c) => ({ front: c.front, back: c.back })),
      clonedFromId: originalDeck._id,
      createdBy: req.userId,
      tenantId: filter.tenantId,
      tags: originalDeck.tags,
    });

    res.status(201).json(clonedDeck);
  } catch (error) {
    next(error);
  }
};
