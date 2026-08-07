const logger = require('./logger');

class MessageBroker {
  static async publish(topic, payload) {
    logger.info(`Published message to ${topic}`);
    // Kafka producer stub
    return true;
  }
}
module.exports = MessageBroker;
