// Same wrong path as anomaly.service.js — both came out of the same
// scaffolding commit. Latent rather than fatal only because nothing requires
// this file yet (#792).
const logger = require('../utils/logger');

class MessageBroker {
  // `payload` stays in the signature — it is what the producer below will send
  // once it is real — but nothing reads it yet.
  // eslint-disable-next-line no-unused-vars
  static async publish(topic, payload) {
    logger.info(`Published message to ${topic}`);
    // Kafka producer stub
    return true;
  }
}
module.exports = MessageBroker;
