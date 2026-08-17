const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const cardSchema = new mongoose.Schema(
  {
    front: {
      type: String,
      required: true,
      trim: true,
    },
    back: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const flashcardDeckSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    exam: {
      type: String,
      required: [true, 'Exam is required'],
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    clonedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FlashcardDeck',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    downloadsCount: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    cards: {
      type: [cardSchema],
      validate: [
        (val) => val.length > 0,
        'A flashcard deck must have at least one card',
      ],
    },
  },
  { timestamps: true },
);

// Indexing for search queries and user filtering
flashcardDeckSchema.index({ tenantId: 1, createdBy: 1 });
flashcardDeckSchema.index({ isPublic: 1, subject: 1, exam: 1 });

flashcardDeckSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('FlashcardDeck', flashcardDeckSchema);
