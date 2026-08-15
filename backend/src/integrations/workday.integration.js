/**
 * Workday Integration Adapter
 *
 * Fetches active workers via Workday RAAS (Report-as-a-Service) and maps
 * them to PaySphere's Employee schema shape.
 *
 * Required config: { username: string, password: string, raasUrl: string }
 */
'use strict';

const BaseIntegration = require('./base.integration');
const logger = require('../utils/logger');

class WorkdayIntegration extends BaseIntegration {
  constructor(config) {
    super(config);
    this._raasUrl = config.raasUrl;
    this._auth    = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  _mapWorker(w) {
    return {
      externalId:    w.Worker_ID,
      fullName:      w.Worker_Name,
      email:         w.Email_Address,
      department:    w.Organization,
      designation:   w.Business_Title,
      dateOfJoining: w.Hire_Date ? new Date(w.Hire_Date) : null,
      provider:      'workday',
    };
  }

  async fetchEmployees() {
    try {
      const res = await fetch(this._raasUrl, {
        headers: { Authorization: `Basic ${this._auth}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Workday RAAS ${res.status}: ${res.statusText}`);
      const data    = await res.json();
      const workers = data?.Report_Entry || [];
      const mapped  = workers.map((w) => this._mapWorker(w));
      logger.info('Workday sync complete', { count: mapped.length });
      return mapped;
    } catch (err) {
      logger.error('Workday fetchEmployees failed', { error: err.message });
      return [];
    }
  }

  async pushPayslip(payslip) {
    logger.info('Workday pushPayslip stub', { employeeId: payslip?.employeeId });
  }

  async onEmployeeTerminated(externalId) {
    logger.info('Workday termination event', { externalId });
  }
}

module.exports = WorkdayIntegration;
