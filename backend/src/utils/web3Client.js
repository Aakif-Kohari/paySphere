const logger = require('./logger');
const crypto = require('crypto');

let ethers = null;
try {
  ethers = require('ethers');
} catch (err) {
  logger.warn('ethers SDK not found. Web3 client will run in mock compliance mode.');
}

class Web3Client {
  constructor() {
    this.rpcUrl = process.env.EVM_RPC_URL || 'https://cloudflare-eth.com';
    this.provider = ethers ? new ethers.providers.JsonRpcProvider(this.rpcUrl) : null;
  }

  /**
   * Estimates optimized gas parameters (maxFeePerGas, maxPriorityFeePerGas) for EIP-1559.
   */
  async estimateOptimizedGas() {
    if (!this.provider) {
      // Mocked gas pricing
      return {
        maxFeePerGas: '35000000000', // 35 Gwei
        maxPriorityFeePerGas: '2000000000', // 2 Gwei
        gasLimit: 150000
      };
    }

    try {
      const feeData = await this.provider.getFeeData();
      return {
        maxFeePerGas: feeData.maxFeePerGas?.toString() || '35000000000',
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '2000000000',
        gasLimit: 150000
      };
    } catch (error) {
      logger.warn('Failed to fetch gas fees from RPC. Using defaults.', { error: error.message });
      return {
        maxFeePerGas: '35000000000',
        maxPriorityFeePerGas: '2000000000',
        gasLimit: 150000
      };
    }
  }

  /**
   * Executes a batch stablecoin transfer via a multisig or distributor contract to optimize gas fees.
   * 
   * @param {string} senderPrivateKey - Wallet private key
   * @param {string} tokenAddress - ERC20 token address (USDT/USDC)
   * @param {Array<{address: string, amount: number}>} recipients - Array of receivers and amounts
   * @returns {Promise<string>} The transaction hash
   */
  async batchTransferStablecoins(senderPrivateKey, tokenAddress, recipients) {
    const gasParams = await this.estimateOptimizedGas();

    if (!ethers || !this.provider) {
      // Mock transaction generation for testing/development
      const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      logger.info('Simulated batch transfer on-chain', { txHash, recipientCount: recipients.length });
      return txHash;
    }

    try {
      const wallet = new ethers.Wallet(senderPrivateKey, this.provider);
      
      const batchContractAddress = process.env.BATCH_DISBURSE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
      const abi = [
        "function batchTransfer(address token, address[] recipients, uint256[] amounts) external returns (bool)"
      ];
      
      const contract = new ethers.Contract(batchContractAddress, abi, wallet);
      const addresses = recipients.map(r => r.address);
      const amounts = recipients.map(r => ethers.utils.parseUnits(r.amount.toFixed(6), 6));

      const tx = await contract.batchTransfer(tokenAddress, addresses, amounts, {
        maxFeePerGas: gasParams.maxFeePerGas,
        maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        gasLimit: gasParams.gasLimit * recipients.length
      });

      logger.info(`On-chain batch transfer broadcasted: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error('Failed to execute batch transfer on-chain', { error: error.message });
      throw error;
    }
  }

  /**
   * Polls EVM node for transaction receipt.
   * 
   * @param {string} txHash - Transaction hash
   * @returns {Promise<{success: boolean, blockNumber?: number, confirmations: number}>}
   */
  async getTransactionReceipt(txHash) {
    if (!ethers || !this.provider) {
      // Mock successful receipt
      return {
        success: true,
        blockNumber: 154321,
        confirmations: 12
      };
    }

    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return { success: false, confirmations: 0 };
      }
      return {
        success: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations
      };
    } catch (error) {
      logger.error('Error fetching transaction receipt', { error: error.message });
      return { success: false, confirmations: 0 };
    }
  }
}

module.exports = new Web3Client();
