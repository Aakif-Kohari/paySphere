"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoPayrollService = void 0;
// @ts-nocheck
const express_1 = require("express");
class CryptoPayrollService {
    wallets = [
        {
            id: 'wlt-101',
            chainName: 'Solana Network',
            tokenSymbol: 'USDC-SPL',
            walletAddress: '8xZ9...44mA',
            tokenBalance: 1450000.00,
            usdEquivalent: 1450000.00,
            status: 'ACTIVE',
        },
        {
            id: 'wlt-102',
            chainName: 'Ethereum Mainnet',
            tokenSymbol: 'USDT-ERC20',
            walletAddress: '0x71...99e0',
            tokenBalance: 980000.00,
            usdEquivalent: 980000.00,
            status: 'ACTIVE',
        },
    ];
    getWallets() {
        return this.wallets;
    }
    disburseOnChain(recipientWallet, amountUSD, tokenSymbol) {
        const txHash = `0x${Math.random().toString(36).substr(2, 16)}`;
        return { success: true, txHash };
    }
}
exports.CryptoPayrollService = CryptoPayrollService;
const cryptoService = new CryptoPayrollService();
const cryptoRouter = (0, express_1.Router)();
const cryptoController = require('../controllers/crypto.controller');
cryptoRouter.get('/crypto/wallets', (req, res) => {
    res.json({ success: true, data: cryptoService.getWallets() });
});
cryptoRouter.post('/crypto/disburse', (req, res) => {
    const { recipientWallet, amountUSD, tokenSymbol } = req.body;
    const result = cryptoService.disburseOnChain(recipientWallet, amountUSD, tokenSymbol);
    res.json({ success: true, data: result });
});
cryptoRouter.post('/crypto/disburse-batch', (req, res, next) => {
    cryptoController.disburseCryptoBatch(req, res, next);
});
cryptoRouter.get('/crypto/payout-logs', (req, res, next) => {
    cryptoController.getPayoutLogs(req, res, next);
});
exports.default = cryptoRouter;
//# sourceMappingURL=CryptoPayrollService.js.map