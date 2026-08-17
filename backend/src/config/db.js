const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Monitor connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB. Attempting automatic reconnection...');
});

const connectDB = async (retries = 5, delay = 1000) => {
  // Support both names used by local .env files and hosted deployments.
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB connection string is missing. Set MONGO_URI or MONGODB_URI.');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempting MongoDB connection (Attempt ${attempt}/${retries})...`);
      await mongoose.connect(mongoUri);
      logger.info('MongoDB connected successfully');
      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt} failed`, { error: err.message });
      if (attempt === retries) {
        logger.error('All MongoDB connection attempts exhausted. Exiting...');
        process.exit(1);
      }
      logger.info(`Waiting ${delay / 1000}s before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
};

module.exports = connectDB;
