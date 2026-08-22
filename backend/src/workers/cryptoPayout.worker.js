const { CryptoPayoutBatch } = require('../models/cryptoPayroll.model');
const web3Client = require('../utils/web3Client');
const logger = require('../utils/logger');

/**
 * Worker service to process stablecoin cryptocurrency payouts.
 */
class CryptoPayoutWorker {
  /**
   * Processes a queued payout batch by executing a batch transfer on-chain.
   * 
   * @param {string} batchId - Database ID of the CryptoPayoutBatch
   */
  async processPayoutBatch(batchId) {
    logger.info(`Starting crypto payout processing for batch ${batchId}...`);
    const batch = await CryptoPayoutBatch.findById(batchId);
    if (!batch) {
      logger.error(`Crypto payout batch ${batchId} not found.`);
      return;
    }

    try {
      const privateKey = process.env.CRYPTO_VAULT_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
      const tokenAddress = batch.tokenAddress;
      const recipients = batch.recipients.map(r => ({
        address: r.address,
        amount: r.amount
      }));

      // Execute EIP-1559 optimized batch stablecoin transfer on-chain
      const txHash = await web3Client.batchTransferStablecoins(privateKey, tokenAddress, recipients);

      batch.txHash = txHash;
      batch.status = 'Pending';
      await batch.save();

      // Start asynchronous verification tracking
      this.pollTxReceipt(batchId, txHash).catch(err => {
        logger.error(`Receipt tracking failed for batch ${batchId}`, { error: err.message });
      });

    } catch (error) {
      logger.error(`Failed to process crypto payout batch ${batchId}`, { error: error.message });
      batch.status = 'Failed';
      await batch.save();
    }
  }

  /**
   * Polls EVM RPC nodes until transaction receipts are confirmed.
   * 
   * @param {string} batchId - Batch ID
   * @param {string} txHash - Transaction hash
   */
  async pollTxReceipt(batchId, txHash) {
    const maxAttempts = 15;
    const intervalMs = 5000; // Poll every 5 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`Polling transaction receipt for batch ${batchId} (Attempt ${attempt}/${maxAttempts})...`);
        const receipt = await web3Client.getTransactionReceipt(txHash);

        if (receipt && receipt.success) {
          const batch = await CryptoPayoutBatch.findById(batchId);
          if (batch) {
            batch.status = 'Confirmed';
            batch.blockNumber = receipt.blockNumber || 0;
            batch.confirmations = receipt.confirmations || 1;
            batch.confirmedAt = new Date();
            await batch.save();
            logger.info(`On-chain transaction confirmed for batch ${batchId}. Receipt logged.`);
          }
          return;
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, intervalMs));

      } catch (err) {
        logger.warn(`Failed to fetch receipt on attempt ${attempt}`, { error: err.message });
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    // Mark as failed if polling limit exceeded without success
    const batch = await CryptoPayoutBatch.findById(batchId);
    if (batch && batch.status === 'Pending') {
      batch.status = 'Failed';
      await batch.save();
      logger.error(`Polling limit reached. Transaction status unconfirmed for batch ${batchId}.`);
    }
  }
}

module.exports = new CryptoPayoutWorker();
