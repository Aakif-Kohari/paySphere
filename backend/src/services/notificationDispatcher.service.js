'use strict';
const NotificationPreference = require('../models/notificationPreference.model');
const registry               = require('../notifications/registry');
const cacheService           = require('./cache.service');
const logger                 = require('./logger');
const DEDUP_TTL = 5 * 60;
const T = {
  PAYROLL_COMPLETED:  (p) => ({ subject: 'Payroll Run Completed', body: 'The ' + p.month + '/' + p.year + ' payroll run has been completed successfully.' }),
  SALARY_CHANGED:     (p) => ({ subject: 'Your Salary Has Been Updated', body: 'Your monthly salary has been updated to ' + (p.currency||'') + ' ' + p.newSalary + '.' }),
  EMPLOYEE_ONBOARDED: (p) => ({ subject: 'New Employee Onboarded', body: (p.fullName||'A new employee') + ' has been added.' }),
  LOAN_DEDUCTED:      (p) => ({ subject: 'Loan EMI Deducted', body: 'An EMI of ' + p.amount + ' has been deducted from your ' + p.month + '/' + p.year + ' payroll.' }),
  EXPENSE_APPROVED:   (p) => ({ subject: 'Expense Claim Approved', body: 'Your expense claim of ' + p.amount + ' has been approved.' }),
  EXPENSE_REJECTED:   (p) => ({ subject: 'Expense Claim Rejected', body: 'Your expense claim of ' + p.amount + ' was rejected. Reason: ' + (p.reason||'Not specified') + '.' }),
  APPROVAL_REQUIRED:  (p) => ({ subject: 'Action Required: Payroll Approval', body: 'A payroll run for ' + p.month + '/' + p.year + ' is awaiting your approval.' }),
};
async function dispatch(eventType, payload, userId) {
  const key = 'notif:dedup:' + userId + ':' + eventType;
  if (await cacheService.get(key)) { logger.debug('Notification suppressed (dedup)', { eventType, userId }); return; }
  try {
    const prefs = await NotificationPreference.findOne({ userId, eventType }).lean();
    if (prefs && !prefs.enabled) { logger.debug('Notification suppressed (pref)', { eventType, userId }); return; }
    const channels = (prefs && prefs.channels) || ['in_app'];
    const tmpl = T[eventType];
    if (!tmpl) { logger.warn('No template for event', { eventType }); return; }
    const { subject, body } = tmpl(payload);
    const deliveries = channels.map(async (ch) => {
      try { await registry.get(ch).send({ to: String(userId), subject, body, metadata: Object.assign({}, payload) }); }
      catch (err) { logger.error('Delivery failed', { ch, eventType, userId, error: err.message }); }
    });
    await Promise.allSettled(deliveries);
    await cacheService.set(key, true, DEDUP_TTL);
  } catch (err) {
    logger.error('NotificationDispatcher.dispatch error', { eventType, userId, error: err.message });
  }
}
module.exports = { dispatch };