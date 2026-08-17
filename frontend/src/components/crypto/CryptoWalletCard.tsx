import React from 'react';
import { Wallet, ShieldCheck, ArrowRight, Zap, Coins } from 'lucide-react';

export interface CryptoVaultWallet {
  id: string;
  chainName: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string;
  walletAddress: string;
  tokenBalance: number;
  usdEquivalent: number;
  networkFeeUSD: number;
  status: 'ACTIVE' | 'PAUSED' | 'REBALANCING';
}

interface CryptoWalletCardProps {
  wallet: CryptoVaultWallet;
  onInspect: () => void;
}

export default function CryptoWalletCard({ wallet, onInspect }: CryptoWalletCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-purple-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Network & Token */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{wallet.tokenLogo}</span>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition">
                {wallet.tokenSymbol}
              </h3>
              <p className="text-xs text-slate-400 font-medium">{wallet.chainName}</p>
            </div>
          </div>

          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {wallet.status}
          </span>
        </div>

        {/* Balance Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">On-Chain Vault Balance</div>
          <div className="text-2xl font-black text-white">
            {wallet.tokenBalance.toLocaleString()} {wallet.tokenSymbol}
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            ≈ ${wallet.usdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
          </div>
        </div>

        {/* Address & Gas Stack */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Vault Address:</span>
            <span className="text-purple-400 font-bold">{wallet.walletAddress}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Average Gas Fee:</span>
            <span className="text-amber-400 font-bold">${wallet.networkFeeUSD} USD</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">Multi-Sig Vault Secure</span>
        <button
          onClick={onInspect}
          className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 transition flex items-center gap-1"
        >
          <span>Vault Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
