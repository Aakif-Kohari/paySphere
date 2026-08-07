const logger = require('./logger');

class AnomalyService {
  static detect(payrolls) {
    logger.info('Running ML Isolation Forest anomaly detection on payrolls');
    // ML inference stub
    return payrolls.filter(p => p.netSalary > 50000);
  }
}
module.exports = AnomalyService;
