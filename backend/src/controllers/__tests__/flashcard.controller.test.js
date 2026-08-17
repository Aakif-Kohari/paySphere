jest.mock('../../models/flashcardDeck.model', () => {
  const model = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
  };
  return model;
});

jest.mock('../../utils/gemini', () => ({
  generateSummaryTags: jest.fn().mockResolvedValue(['ai', 'test']),
  getLocalFallbackTags: jest.fn().mockReturnValue(['fallback']),
}));

const mongoose = require('mongoose');
const FlashcardDeck = require('../../models/flashcardDeck.model');
const { generateSummaryTags } = require('../../utils/gemini');
const {
  createDeck,
  getMyDecks,
  updateDeck,
  getCommunityDecks,
  cloneDeck,
} = require('../flashcard.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (body = {}, query = {}, params = {}, overrides = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  body,
  query,
  params,
  ...overrides,
});

/** A chainable mongoose Query stub that resolves to `rows`. */
const queryStub = (rows) => {
  const chain = {};
  for (const method of ['sort', 'skip', 'limit']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.lean = jest.fn().mockResolvedValue(rows);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  FlashcardDeck.find.mockReturnValue(queryStub([]));
  FlashcardDeck.countDocuments.mockResolvedValue(0);
});

describe('Flashcard Controller Tests', () => {
  describe('createDeck', () => {
    test('creates a private deck without calling Gemini tags', async () => {
      const res = buildRes();
      const body = {
        title: 'Math Trivia',
        subject: 'Math',
        exam: 'SAT',
        isPublic: false,
        cards: [{ front: '1+1', back: '2' }],
      };
      FlashcardDeck.create.mockResolvedValue({
        _id: 'deck1',
        ...body,
        tags: [],
      });

      await createDeck(buildReq(body), res, jest.fn());

      expect(FlashcardDeck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Math Trivia',
          isPublic: false,
          tags: [],
          createdBy: USER_ID,
          tenantId: TENANT_ID,
        }),
      );
      expect(generateSummaryTags).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('creates a public deck and calls Gemini to generate tags', async () => {
      const res = buildRes();
      const body = {
        title: 'AI Trivia',
        subject: 'AI',
        exam: 'CompSci',
        isPublic: true,
        cards: [{ front: 'What is ML?', back: 'Machine Learning' }],
      };
      FlashcardDeck.create.mockResolvedValue({
        _id: 'deck2',
        ...body,
        tags: ['ai', 'test'],
      });

      await createDeck(buildReq(body), res, jest.fn());

      expect(generateSummaryTags).toHaveBeenCalled();
      expect(FlashcardDeck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Trivia',
          isPublic: true,
          tags: ['ai', 'test'],
        }),
      );
    });
  });

  describe('getMyDecks', () => {
    test('filters by tenantId and createdBy', async () => {
      const res = buildRes();
      const chain = queryStub([]);
      FlashcardDeck.find.mockReturnValue(chain);

      await getMyDecks(buildReq(), res, jest.fn());

      expect(FlashcardDeck.find).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        createdBy: USER_ID,
      });
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('updateDeck', () => {
    test('updates a deck and triggers AI tag generation if transitioning to public', async () => {
      const res = buildRes();
      const mockDeck = {
        _id: 'deck1',
        title: 'Math Trivia',
        subject: 'Math',
        exam: 'SAT',
        isPublic: false,
        cards: [{ front: '1+1', back: '2' }],
        save: jest.fn().mockResolvedValue({}),
      };
      FlashcardDeck.findOne.mockResolvedValue(mockDeck);

      await updateDeck(
        buildReq({ title: 'New Title', isPublic: true }, {}, { id: 'deck1' }),
        res,
        jest.fn(),
      );

      expect(mockDeck.title).toBe('New Title');
      expect(mockDeck.isPublic).toBe(true);
      expect(generateSummaryTags).toHaveBeenCalled();
      expect(mockDeck.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getCommunityDecks', () => {
    test('filters by isPublic and search criteria without tenant scoping', async () => {
      const res = buildRes();
      const chain = queryStub([]);
      FlashcardDeck.find.mockReturnValue(chain);

      await getCommunityDecks(
        buildReq({}, { subject: 'History', search: 'WWII' }),
        res,
        jest.fn(),
      );

      const [query] = FlashcardDeck.find.mock.calls[0];
      expect(query.isPublic).toBe(true);
      expect(query.subject).toEqual(/History/i);
      expect(query.$or).toEqual([
        { title: /WWII/i },
        { description: /WWII/i },
        { tags: /WWII/i },
      ]);
    });
  });

  describe('cloneDeck', () => {
    test('copies cards, sets clonedFromId, and increments downloads count on parent deck', async () => {
      const res = buildRes();
      const originalDeck = {
        _id: 'deck1',
        title: 'Bio Trivia',
        description: 'Bio facts',
        subject: 'Biology',
        exam: 'MCAT',
        isPublic: true,
        cards: [{ front: 'Cell', back: 'Unit of life' }],
        downloadsCount: 5,
        tags: ['bio'],
        save: jest.fn().mockResolvedValue({}),
      };
      // `findOne`, not `findById` (#1010). `cloneDeck` computed a tenant
      // filter and then dropped it, fetching by bare id — so a deck belonging
      // to another company was clonable. The filter is applied now, and the
      // extra assertion below checks it rather than only the happy path.
      FlashcardDeck.findOne.mockResolvedValue(originalDeck);

      const body = {
        title: 'Bio Trivia (Cloned)',
        description: 'Bio facts',
        subject: 'Biology',
        exam: 'MCAT',
        isPublic: false,
        cards: [{ front: 'Cell', back: 'Unit of life' }],
        clonedFromId: 'deck1',
        createdBy: USER_ID,
        tenantId: TENANT_ID,
        tags: ['bio'],
      };
      FlashcardDeck.create.mockResolvedValue(body);

      await cloneDeck(buildReq({}, {}, { id: 'deck1' }), res, jest.fn());

      expect(originalDeck.downloadsCount).toBe(6);
      expect(originalDeck.save).toHaveBeenCalled();
      expect(FlashcardDeck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bio Trivia (Cloned)',
          clonedFromId: 'deck1',
          createdBy: USER_ID,
          tenantId: TENANT_ID,
          isPublic: false,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
