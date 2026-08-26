import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowRightLeft, Activity, DollarSign, TrendingUp, TrendingDown,
    CheckCircle, ShieldAlert, CreditCard
} from 'lucide-react';
import treasuryService from '../../services/treasury/treasuryService';

interface TradeProps {
    onTradeExecutionSuccess: () => void;
    wallets: any[];
}

const ForexExchangeBoard: React.FC<TradeProps> = ({ onTradeExecutionSuccess, wallets }) => {
    const [rates, setRates] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // Trade Form State
    const [sourceCurrency, setSourceCurrency] = useState('USD');
    const [targetCurrency, setTargetCurrency] = useState('EUR');
    const [amountSold, setAmountSold] = useState<number | ''>(100000);
    const [isExecuting, setIsExecuting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        fetchRates();
        const interval = setInterval(fetchRates, 15000); // simulate live ticker
        return () => clearInterval(interval);
    }, []);

    const fetchRates = async () => {
        try {
            const resp = await treasuryService.getLiveRates();
            setRates(resp?.data || {});
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Safe division handling
    const currentRate = useMemo(() => {
        if (!rates[sourceCurrency] || !rates[targetCurrency]) return 1;
        return rates[targetCurrency] / rates[sourceCurrency];
    }, [rates, sourceCurrency, targetCurrency]);

    const targetReceived = useMemo(() => {
        if (typeof amountSold !== 'number') return 0;
        return amountSold * currentRate;
    }, [amountSold, currentRate]);

    const sourceWallet = useMemo(() => {
        return wallets.find(w => w.currency === sourceCurrency);
    }, [wallets, sourceCurrency]);

    const handleExecute = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (typeof amountSold !== 'number' || amountSold <= 0) {
            setErrorMsg('Enter a valid amount to swap.');
            return;
        }
        if (sourceWallet && (amountSold > (sourceWallet.balance - sourceWallet.reservedBalance))) {
            setErrorMsg(`Insufficient unrestricted liquidity in ${sourceCurrency} wallet.`);
            return;
        }

        setIsExecuting(true);
        try {
            await treasuryService.splitExecuteForex({ sourceCurrency, targetCurrency, amountSold });
            setSuccessMsg(`Successfully executed ledger swap for ${targetReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${targetCurrency}`);
            onTradeExecutionSuccess();
            setAmountSold('');
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || err.message || 'Execution failed');
        } finally {
            setIsExecuting(false);
        }
    };

    const getRateChangeClass = () => {
        // mock volatility display
        return Math.random() > 0.5 ? 'text-emerald-500' : 'text-red-500';
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Trading Execution Terminal */}
            <div className="xl:col-span-1 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                <div className="bg-indigo-600 p-6 text-white pb-12">
                    <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                        <ArrowRightLeft /> Forex Trading Desk
                    </h2>
                    <p className="text-indigo-200 text-sm">Execute intra-company ledger swaps to satisfy regional payroll liquidity requirements instantly.</p>
                </div>

                <form onSubmit={handleExecute} className="px-6 pb-6 relative -mt-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl mb-6">

                        {/* Source */}
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Sell Currency (Source Ledger)</label>
                            <div className="flex border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                                <select
                                    value={sourceCurrency}
                                    onChange={(e) => setSourceCurrency(e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 px-4 py-3 font-bold text-lg outline-none"
                                >
                                    {['USD', 'EUR', 'GBP', 'INR', 'SGD', 'CAD', 'JPY'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Amount to sell..."
                                    value={amountSold}
                                    onChange={(e) => setAmountSold(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="flex-1 px-4 py-3 bg-transparent text-right font-black text-xl outline-none"
                                />
                            </div>
                            <div className="mt-2 text-xs flex justify-between text-slate-500">
                                <span>Available Liquidity:</span>
                                <span className={`font-bold ${sourceWallet && typeof amountSold === 'number' && amountSold > (sourceWallet.balance - sourceWallet.reservedBalance)
                                        ? 'text-red-500' : 'text-slate-800 dark:text-slate-300'
                                    }`}>
                                    {sourceWallet ? (sourceWallet.balance - sourceWallet.reservedBalance).toLocaleString() : 0} {sourceCurrency}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-center -my-3 relative z-10">
                            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 p-2 rounded-full absolute">
                                <ArrowRightLeft className="w-5 h-5 text-slate-500 rotate-90" />
                            </div>
                        </div>

                        {/* Target */}
                        <div className="mt-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Buy Currency (Target Ledger)</label>
                            <div className="flex border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                                <select
                                    value={targetCurrency}
                                    onChange={(e) => setTargetCurrency(e.target.value)}
                                    className="bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 px-4 py-3 font-bold text-lg outline-none cursor-pointer"
                                >
                                    {['USD', 'EUR', 'GBP', 'INR', 'SGD', 'CAD', 'JPY'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="flex-1 px-4 py-3 text-right font-black text-xl text-emerald-600 dark:text-emerald-400">
                                    {targetReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="mt-2 text-xs flex justify-between text-slate-500">
                                <span>Realtime Execution Rate (Indicative):</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                    1 {sourceCurrency} = {currentRate.toFixed(4)} {targetCurrency}
                                </span>
                            </div>
                        </div>

                    </div>

                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex gap-2 items-center mb-6 border border-red-100">
                            <ShieldAlert className="w-5 h-5 shrink-0" /> {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-sm font-bold flex gap-2 items-center mb-6 border border-emerald-100">
                            <CheckCircle className="w-5 h-5 shrink-0" /> {successMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isExecuting || sourceCurrency === targetCurrency}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-lg rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isExecuting ? <Activity className="animate-spin w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                        {isExecuting ? 'Booking Swap...' : 'Execute Internal Forex Swap'}
                    </button>
                </form>
            </div>

            {/* Ticker Tape & Market Board */}
            <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Globe className="w-[400px] h-[400px]" />
                </div>
                <h3 className="text-xl font-bold flex items-center gap-3 mb-8">
                    <Activity className="text-emerald-400" /> Active Treasury Market Quotes
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse"></div>)
                    ) : Object.keys(rates).map(key => {
                        if (key === 'USD') return null; // Baseline
                        const isUp = Math.random() > 0.5;
                        return (
                            <div key={key} className="bg-slate-800/80 backdrop-blur border border-slate-700/50 p-5 rounded-2xl group hover:border-slate-500 transition-colors">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-slate-300">USD / {key}</span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <span className="text-3xl font-black font-mono tracking-tight">{rates[key].toFixed(4)}</span>
                                    <span className={`flex items-center gap-1 text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                        {(Math.random() * 0.5).toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <h4 className="text-lg font-bold mb-4 text-slate-300 border-b border-slate-700 pb-2">Forex Compliance Strategy Guide</h4>
                    <ul className="space-y-3 text-sm text-slate-400 leading-relaxed">
                        <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" /> Treasury swaps trigger automatic ledger reconciliation required by SOX compliance frameworks.</li>
                        <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> Target currency balances must pre-satisfy 75% of next week's gross payroll obligation to avoid critical liquidity alerts.</li>
                        <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" /> Selling restricted buffer cash will immediately flag an HR / Legal Audit Ticket.</li>
                        <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" /> Rates shown are intra-company simulated pegging; actual settlements are buffered through PaySphere clearing accounts.</li>
                    </ul>
                </div>
            </div>

        </div>
    );
};

export default ForexExchangeBoard;
