// `logger` lives in utils, not alongside the services. As written this threw
// MODULE_NOT_FOUND, and because payroll.controller.js requires this file the
// throw propagated up through payroll.routes.js to app.js — a scaffolding stub
// nothing calls was enough on its own to stop the server booting (#792).
const logger = require('../utils/logger');

class AnomalyService {
  static detect(payrolls) {
    logger.info('Running ML Isolation Forest anomaly detection on payrolls');
    // ML inference stub
    return payrolls.filter((p) => p.netSalary > 50000);
  }
}
module.exports = AnomalyService;
