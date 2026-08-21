import { CurrencyWallet, ForexTrade, LiquidityForecast } from '../models/TreasuryModels.js';
import mongoose from 'mongoose';

const MOCK_ORG_ID = 'ORG-ENT-GLOBAL';

class TreasuryService {
    async ensureMockDataExists() {
        try {
            const walletCount = await CurrencyWallet.countDocuments({ organizationId: MOCK_ORG_ID });
            if (walletCount === 0) {
                console.log('Seeding Treasury Currency Wallets...');
                const currencies = [
                    { c: 'USD', b: 4500000, r: 1200000 },
                    { c: 'EUR', b: 2100000, r: 800000 },
                    { c: 'GBP', b: 850000, r: 400000 },
                    { c: 'INR', b: 125000000, r: 45000000 },
                    { c: 'SGD', b: 650000, r: 150000 }
                ];

                for (const wall of currencies) {
                    await CurrencyWallet.create({
                        walletId: `WLT-${wall.c}-${Math.floor(Math.random() * 10000)}`,
                        currency: wall.c,
                        balance: wall.b,
                        reservedBalance: wall.r,
                        organizationId: MOCK_ORG_ID
                    });
                }
            }

            const tradeCount = await ForexTrade.countDocuments({ organizationId: MOCK_ORG_ID });
            if (tradeCount === 0) {
                console.log('Seeding Forex Trades...');
                const trades = [];
                for (let i = 0; i < 40; i++) {
                    const isExecuted = Math.random() > 0.2;
                    trades.push({
                        tradeId: `FXT-${new Date().getTime().toString().slice(-6)}-${i}`,
                        organizationId: MOCK_ORG_ID,
                        sourceCurrency: 'USD',
                        targetCurrency: ['INR', 'EUR', 'GBP'][Math.floor(Math.random() * 3)],
                        amountSold: 100000 + Math.floor(Math.random() * 900000),
                        amountBought: 100000 * 82, // rough multiplier
                        exchangeRate: 82.0 + Math.random(),
                        status: isExecuted ? 'SETTLED' : 'PENDING',
                        settlementDate: isExecuted ? new Date(Date.now() - Math.random() * 10000000000) : null
                    });
                }
                await ForexTrade.insertMany(trades);
            }
        } catch (err) {
            console.error('Failed seeding treasury:', err);
        }
    }

    async getWallets() {
        return await CurrencyWallet.find({ organizationId: MOCK_ORG_ID }).lean();
    }

    getMockExchangeRates() {
        // In production this integrates with Bloomberg API or similar
        const baseVariance = () => (Math.random() * 0.02) - 0.01;
        return {
            USD: 1,
            EUR: 0.91 + baseVariance(),
            GBP: 0.79 + baseVariance(),
            INR: 83.15 + (baseVariance() * 50),
            SGD: 1.34 + baseVariance(),
            AUD: 1.52 + baseVariance(),
            AED: 3.67, // Pegged
            JPY: 148.5 + (baseVariance() * 100)
        };
    }

    async executeTrade(tradePayload, userId) {
        const { sourceCurrency, targetCurrency, amountSold } = tradePayload;
        const rates = this.getMockExchangeRates();
        const rate = rates[targetCurrency] / rates[sourceCurrency];
        const amountBought = amountSold * rate;

        // Simulate ledger subtraction
        const sourceWallet = await CurrencyWallet.findOne({ currency: sourceCurrency, organizationId: MOCK_ORG_ID });
        if (!sourceWallet || sourceWallet.balance - sourceWallet.reservedBalance < amountSold) {
            throw new Error(`Insufficient unrestricted liquidity in ${sourceCurrency} wallet.`);
        }

        sourceWallet.balance -= amountSold;
        await sourceWallet.save();

        const targetWallet = await CurrencyWallet.findOne({ currency: targetCurrency, organizationId: MOCK_ORG_ID });
        if (targetWallet) {
            targetWallet.balance += amountBought;
            await targetWallet.save();
        } else {
            await CurrencyWallet.create({
                walletId: `WLT-${targetCurrency}-${Math.floor(Math.random() * 10000)}`,
                currency: targetCurrency,
                balance: amountBought,
                organizationId: MOCK_ORG_ID
            });
        }

        const trade = await ForexTrade.create({
            tradeId: `FXT-${new Date().getTime()}`,
            organizationId: MOCK_ORG_ID,
            sourceCurrency,
            targetCurrency,
            amountSold,
            amountBought,
            exchangeRate: rate,
            status: 'SETTLED',
            executedBy: userId,
            settlementDate: new Date()
        });

        return trade;
    }

    async getTradeLedger(page = 1, limit = 15) {
        const skip = (page - 1) * limit;
        const [trades, total] = await Promise.all([
            ForexTrade.find({ organizationId: MOCK_ORG_ID }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            ForexTrade.countDocuments({ organizationId: MOCK_ORG_ID })
        ]);

        return {
            data: trades,
            metadata: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    async generateLiquidityForecast() {
        const wallets = await this.getWallets();
        const projections = wallets.map(w => {
            // Simulate payroll outflow trajectory for next 90 days based on reserved amounts
            const projectedOutflow = w.reservedBalance * (1.2 + Math.random());
            const projectedInflow = (w.balance * 0.1) * Math.random();
            const netPosition = w.balance + projectedInflow - projectedOutflow;

            let riskLevel = 'STABLE';
            if (netPosition < 0) riskLevel = 'CRITICAL_SHORTFALL';
            else if (netPosition < w.balance * 0.2) riskLevel = 'DEFICIT_WARNING';
            else if (netPosition > w.balance * 1.5) riskLevel = 'SURPLUS';

            return {
                currency: w.currency,
                currentBalance: w.balance,
                projectedInflow: Math.floor(projectedInflow),
                projectedPayrollOutflow: Math.floor(projectedOutflow),
                netPosition: Math.floor(netPosition),
                riskLevel
            };
        });

        // We can save forecasts to db or return directly for the Recharts UI
        return {
            forecastId: `LQ-FCST-${Date.now()}`,
            horizonDays: 90,
            generatedAt: new Date(),
            currencyProjections: projections
        };
    }

    async generateChartTimeSequence() {
        // Generates a mock time series for Recharts Treasury Outflow
        const sequence = [];
        const date = new Date();
        for (let i = 0; i < 90; i += 3) {
            const d = new Date(date);
            d.setDate(d.getDate() + i);
            sequence.push({
                date: d.toLocaleDateString(),
                usdOutflow: 50000 + Math.floor(Math.random() * 20000),
                eurOutflow: 30000 + Math.floor(Math.random() * 15000),
                gbpOutflow: 10000 + Math.floor(Math.random() * 5000),
                inrOutflow: 4000000 + Math.floor(Math.random() * 1000000),
                liquidityBuffer: 2000000 + Math.floor(Math.sin(i) * 500000)
            });
        }
        return sequence;
    }
}

export default new TreasuryService();
