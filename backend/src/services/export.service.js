const { Worker } = require("worker_threads");
const path = require("path");
const logger = require("../utils/logger");

class ExportService {
  /**
   * Spawns a worker thread to generate a PDF report.
   * @param {Object} data - The data payload for the PDF.
   * @returns {Promise<Buffer>} - The generated PDF buffer.
   */
  generatePDF(data) {
    return new Promise((resolve, reject) => {
      const workerPath = path.resolve(__dirname, "../workers/pdf.worker.js");
      const worker = new Worker(workerPath, { workerData: data });

      worker.on("message", (msg) => {
        if (msg.success) {
          resolve(Buffer.from(msg.buffer));
        } else {
          reject(new Error(msg.error));
        }
      });

      worker.on("error", (err) => {
        logger.error("PDF Worker error:", err);
        reject(err);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(\`PDF Worker stopped with exit code \${code}\`));
        }
      });
    });
  }

  /**
   * Spawns a worker thread to generate a CSV export.
   * @param {Object} data - The data payload for the CSV.
   * @returns {Promise<string>} - The generated CSV string.
   */
  generateCSV(data) {
    return new Promise((resolve, reject) => {
      const workerPath = path.resolve(__dirname, "../workers/csv.worker.js");
      const worker = new Worker(workerPath, { workerData: data });

      worker.on("message", (msg) => {
        if (msg.success) {
          resolve(msg.csvString);
        } else {
          reject(new Error(msg.error));
        }
      });

      worker.on("error", (err) => {
        logger.error("CSV Worker error:", err);
        reject(err);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(\`CSV Worker stopped with exit code \${code}\`));
        }
      });
    });
  }
}

module.exports = new ExportService();
