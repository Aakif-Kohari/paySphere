/**
 * BambooHR Integration Adapter
 *
 * Fetches active employees via the BambooHR REST API v1 and maps them
 * to PaySphere's Employee schema shape.
 *
 * Required config: { apiKey: string, subdomain: string }
 * Docs: https://documentation.bamboohr.com/reference
 */
'use strict';

const BaseIntegration = require('./base.integration');
const logger = require('../utils/logger');

class BambooHRIntegration extends BaseIntegration {
  constructor(config) {
    super(config);
    this._baseUrl = `https://api.bamboohr.com/api/gateway.php/${config.subdomain}/v1`;
    this._auth    = Buffer.from(`${config.apiKey}:x`).toString('base64');
  }

  _mapEmployee(e) {
    return {
      externalId:    e.id,
      fullName:      `${e.firstName || ''} ${e.lastName || ''}`.trim(),
      email:         e.workEmail,
      department:    e.department,
      designation:   e.jobTitle,
      employeeType:  e.employmentHistoryStatus === 'Full-Time' ? 'full-time' : 'part-time',
      dateOfJoining: e.hireDate ? new Date(e.hireDate) : null,
      provider:      'bamboohr',
    };
  }

  async fetchEmployees() {
    try {
      const res = await fetch(`${this._baseUrl}/employees/directory`, {
        headers: { Authorization: `Basic ${this._auth}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`BambooHR API ${res.status}: ${res.statusText}`);
      const { employees = [] } = await res.json();
      const mapped = employees.map((e) => this._mapEmployee(e));
      logger.info('BambooHR sync complete', { count: mapped.length });
      return mapped;
    } catch (err) {
      logger.error('BambooHR fetchEmployees failed', { error: err.message });
      return [];
    }
  }

  async pushPayslip(payslip) {
    logger.info('BambooHR pushPayslip (stub — BambooHR does not accept inbound payslips)', {
      employeeId: payslip?.employeeId,
    });
  }

  async onEmployeeTerminated(externalId) {
    logger.info('BambooHR termination event received', { externalId });
  }
}

module.exports = BambooHRIntegration;
