const { sendEmail } = require('../utils/email');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const logger = require('../utils/logger');
const User = require('../models/user.model');
const { resolveEmployeeLanguage, translate } = require('../utils/i18n');

// Wrap sendEmail in circuit breaker (Issue #685)
const emailBreaker = createCircuitBreaker(sendEmail, 'smtp-email-service', {
  timeout: 15000, // Email can take a bit longer
  errorThresholdPercentage: 60,
  resetTimeout: 60000, // Wait 1 minute before retrying SMTP
});

exports.sendPayslipEmail = async (employee, payroll) => {
  if (!employee.email) {
    logger.warn(`No email found for employee`, {
      employeeName: employee.fullName,
    });
    return;
  }

  // Fetch user to get company logo
  let companyLogo = null;
  let employeeLanguage = resolveEmployeeLanguage(employee);
  try {
    const user = await User.findById(employee.createdBy);
    if (user && user.settings && user.settings.companyInfo) {
      companyLogo = user.settings.companyInfo.companyLogo;
      employeeLanguage = resolveEmployeeLanguage(employee, user);
    }
  } catch (err) {
    logger.warn('Failed to fetch company logo for payslip email', { error: err.message });
  }

  return new Promise((resolve, reject) => {
    try {
      const { Worker } = require('worker_threads');
      const path = require('path');

      const pdfWorker = new Worker(
        path.join(__dirname, '../workers/pdf.worker.js'),
      );

      pdfWorker.postMessage({
        type: 'GENERATE_PAYSLIP',
        payload: { employee, payroll, companyLogo, language: employeeLanguage },
      });

      // Track whether the promise has already been settled to avoid
      // double-resolve/reject if multiple events fire.
      let settled = false;
      const settle = (fn) => (...args) => {
        if (!settled) {
          settled = true;
          fn(...args);
        }
      };

      pdfWorker.on('message', async (result) => {
        try {
          if (result.success) {
            const pdfData = Buffer.from(result.pdfData);

            const mailOptions = {
              from:
                process.env.EMAIL_FROM || '"PaySphere" <no-reply@paysphere.com>',
              to: employee.email,
              subject: translate(employeeLanguage, 'payslipSubject', payroll),
              text: [
                translate(employeeLanguage, 'payslipGreeting', { name: employee.fullName }),
                '',
                translate(employeeLanguage, 'payslipBody', payroll),
                '',
                translate(employeeLanguage, 'regards'),
                translate(employeeLanguage, 'team'),
              ].join('\n'),
              attachments: [
                {
                  filename: `Payslip_${payroll.month}_${payroll.year}.pdf`,
                  content: pdfData,
                },
              ],
            };

            const info = await emailBreaker.fire(mailOptions);
            if (!info.success) {
              throw new Error(info.error || 'Email delivery failed');
            }
            logger.info(`Payslip email sent to ${employee.email}`);
            settle(resolve)(info);
          } else {
            settle(reject)(new Error('PDF Generation failed: ' + result.error));
          }
        } catch (err) {
          logger.error('Error sending email (Circuit Breaker)', {
            error: err.message,
            employee: employee.email,
          });
          settle(reject)(err);
        } finally {
          // Always terminate — even if sendEmail() throws or PDF generation fails
          pdfWorker.terminate();
        }
      });

      pdfWorker.on('error', (err) => {
        settle(reject)(err);
        pdfWorker.terminate();
      });

      // Guard against silent worker crash: if the worker exits without ever
      // emitting 'message' or 'error', the Promise would hang forever.
      pdfWorker.on('exit', (code) => {
        if (code !== 0) {
          settle(reject)(
            new Error(`PDF worker exited unexpectedly with code ${code}`)
          );
        }
      });
    } catch (error) {
      logger.error('Error generating PDF', { error: error.message });
      reject(error);
    }
  });
};

exports.sendTeamInviteEmail = async (email, inviteToken, inviterName, roleName) => {
  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/accept?token=${inviteToken}`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"PaySphere" <no-reply@paysphere.com>',
    to: email,
    subject: `You have been invited to join ${inviterName}'s team on PaySphere`,
    text: `Hello,\n\nYou have been invited to join ${inviterName}'s team on PaySphere as a ${roleName}.\n\nPlease click the link below to accept the invitation and set up your account:\n${inviteLink}\n\nThis link will expire in 7 days.\n\nRegards,\nThe PaySphere Team`,
    html: `<p>Hello,</p><p>You have been invited to join <strong>${inviterName}</strong>'s team on PaySphere as a <strong>${roleName}</strong>.</p><p><a href="${inviteLink}">Click here to accept the invitation</a></p><p>This link will expire in 7 days.</p><p>Regards,<br>The PaySphere Team</p>`
  };

  try {
    const info = await emailBreaker.fire(mailOptions);
    if (!info.success) {
      throw new Error(info.error || 'Email delivery failed');
    }
    logger.info(`Team invite email sent to ${email}`);
    return true;
  } catch (err) {
    logger.error('Error sending team invite email', {
      error: err.message,
      email,
    });
    throw err;
  }
};

