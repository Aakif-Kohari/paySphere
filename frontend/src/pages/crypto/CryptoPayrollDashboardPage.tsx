import React, { useState } from 'react';
import { ShieldCheck, Download, Search, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, Coins, Wallet, Activity, Zap } from 'lucide-react';
import CryptoWalletCard, { CryptoVaultWallet } from '../../components/crypto/CryptoWalletCard';
import OnChainPayoutTimeline from '../../components/crypto/OnChainPayoutTimeline';

const WALLETS: CryptoVaultWallet[] = [
  {
    id: 'wlt-101',
    chainName: 'Solana Network',
    tokenSymbol: 'USDC-SPL',
    tokenName: 'USD Coin (Solana)',
    tokenLogo: '🪙',
    walletAddress: '8xZ9...44mA',
    tokenBalance: 1450000.00,
    usdEquivalent: 1450000.00,
    networkFeeUSD: 0.00025,
    status: 'ACTIVE',
  },
  {
    id: 'wlt-102',
    chainName: 'Ethereum Mainnet',
    tokenSymbol: 'USDT-ERC20',
    tokenName: 'Tether USD (ERC20)',
    tokenLogo: '🟢',
    walletAddress: '0x71...99e0',
    tokenBalance: 980000.00,
    usdEquivalent: 980000.00,
    networkFeeUSD: 1.85,
    status: 'ACTIVE',
  },
  {
    id: 'wlt-103',
    chainName: 'Polygon POS',
    tokenSymbol: 'USDC-POLYGON',
    tokenName: 'USD Coin (Polygon)',
    tokenLogo: '🟣',
    walletAddress: '0x32...11b4',
    tokenBalance: 620000.00,
    usdEquivalent: 620000.00,
    networkFeeUSD: 0.015,
    status: 'ACTIVE',
  },
  {
    id: 'wlt-104',
    chainName: 'Bitcoin Network',
    tokenSymbol: 'BTC',
    tokenName: 'Bitcoin Cold Reserve',
    tokenLogo: '₿',
    walletAddress: 'bc1q...88zk',
    tokenBalance: 18.5,
    usdEquivalent: 1184000.00,
    networkFeeUSD: 4.50,
    status: 'ACTIVE',
  },
];

export default function CryptoPayrollDashboardPage() {
  const [wallets, setWallets] = useState<CryptoVaultWallet[]>(WALLETS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'wallets' | 'onchain-stream'>('wallets');
  const [selectedWalletModal, setSelectedWalletModal] = useState<CryptoVaultWallet | null>(null);

  const totalUSDCryptoValue = wallets.reduce((acc, w) => acc + w.usdEquivalent, 0);

  const filteredWallets = wallets.filter(w =>
    w.chainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold border border-purple-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Web3 Treasury
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Multi-Sig Gnosis Safe Vault Protected
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
              On-Chain Stablecoin Payroll & Treasury
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Instant sub-second global salary disbursements via USDC/USDT stablecoins across Solana, Ethereum, Polygon, and Bitcoin networks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-purple-600/30 transition flex items-center gap-2 border border-purple-400/20 text-sm">
              <Zap className="w-4 h-4" /> Trigger Batch Smart Contract
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total On-Chain Reserves</span>
              <Coins className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalUSDCryptoValue / 1000000).toFixed(2)}M USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Fully Collateralized Reserves
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Treasury Vaults</span>
              <Wallet className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{wallets.length} Networks</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              Solana, ETH, Polygon & BTC Vaults
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Avg Tx Gas Settlement</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">&lt; $0.001</div>
            <div className="text-amber-400 text-xs mt-2 font-medium">
              Solana & Polygon High-Speed Settlement
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('wallets')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'wallets'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Wallet className="w-4 h-4" /> Treasury Vaults
            </button>
            <button
              onClick={() => setActiveTab('onchain-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'onchain-stream'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> On-Chain Tx Telemetry
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search network or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'onchain-stream' ? (
          <OnChainPayoutTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredWallets.map((wlt) => (
              <CryptoWalletCard
                key={wlt.id}
                wallet={wlt}
                onInspect={() => setSelectedWalletModal(wlt)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedWalletModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{selectedWalletModal.tokenLogo}</span>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedWalletModal.tokenName}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedWalletModal.chainName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Token Balance</span>
                <span className="text-white font-bold text-sm">{selectedWalletModal.tokenBalance.toLocaleString()} {selectedWalletModal.tokenSymbol}</span>
              </div>
              <div>
                <span className="text-slate-500 block">USD Valuation</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedWalletModal.usdEquivalent.toLocaleString()} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Public Wallet Address</span>
                <span className="text-purple-400 font-bold text-sm">{selectedWalletModal.walletAddress}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Est. Network Gas Fee</span>
                <span className="text-amber-400 font-bold text-sm">${selectedWalletModal.networkFeeUSD} USD</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedWalletModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
