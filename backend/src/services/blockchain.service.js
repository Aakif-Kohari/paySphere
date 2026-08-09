const crypto = require('crypto');

class BlockchainService {
  static generateMerkleRoot(payrolls) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(payrolls));
    return hash.digest('hex');
  }

  static async anchorToEthereum(merkleRoot) {
    // Web3 smart contract anchor stub
    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }
}
module.exports = BlockchainService;
