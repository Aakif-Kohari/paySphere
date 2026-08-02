const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');
const User = require('../models/user.model');

exports.sendPayslipEmail = async (employee, payroll) => {
  if (!employee.email) {
    logger.warn(`No email found for employee`, {
      employeeName: employee.fullName,
    });
    return;
  }

  // Fetch user to get company logo
  let companyLogo = null;
  try {
    const user = await User.findById(employee.createdBy);
    if (user && user.settings && user.settings.companyInfo) {
      companyLogo = user.settings.companyInfo.companyLogo;
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
        payload: { employee, payroll, companyLogo },
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
              subject: `Payslip for ${payroll.month}/${payroll.year}`,
              text: `Hello ${employee.fullName},\n\nPlease find attached your payslip for ${payroll.month}/${payroll.year}.\n\nBest Regards,\nPaySphere Team`,
              attachments: [
                {
                  filename: `Payslip_${payroll.month}_${payroll.year}.pdf`,
                  content: pdfData,
                },
              ],
            };

            const info = await sendEmail(mailOptions);
            if (!info.success) {
              throw new Error(info.error || 'Email delivery failed');
            }
            logger.info(`Payslip email sent to ${employee.email}`);
            settle(resolve)(info);
          } else {
            settle(reject)(new Error('PDF Generation failed: ' + result.error));
          }
        } catch (err) {
          logger.error('Error sending email', {
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
