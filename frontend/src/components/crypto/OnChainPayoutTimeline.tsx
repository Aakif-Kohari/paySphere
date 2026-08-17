import React from 'react';
import { CheckCircle2, ShieldCheck, Zap, Activity } from 'lucide-react';

interface OnChainTx {
  id: string;
  txHash: string;
  recipientName: string;
  chain: string;
  amountToken: number;
  tokenSymbol: string;
  usdValue: number;
  blockConfirmations: number;
  timestamp: string;
}

const RECENT_TRANSACTIONS: OnChainTx[] = [
  {
    id: 'tx-901',
    txHash: '5K9x...88mA',
    recipientName: 'Elena Rostova',
    chain: 'Solana (USDC-SPL)',
    amountToken: 12500,
    tokenSymbol: 'USDC',
    usdValue: 12500,
    blockConfirmations: 32,
    timestamp: '5 mins ago',
  },
  {
    id: 'tx-902',
    txHash: '0x8f2...11b0',
    recipientName: 'Marcus Vance',
    chain: 'Polygon (USDC-POLYGON)',
    amountToken: 8400,
    tokenSymbol: 'USDC',
    usdValue: 8400,
    blockConfirmations: 128,
    timestamp: '25 mins ago',
  },
  {
    id: 'tx-903',
    txHash: '0x4c1...99e2',
    recipientName: 'Chloe Bennett',
    chain: 'Ethereum (USDT-ERC20)',
    amountToken: 15000,
    tokenSymbol: 'USDT',
    usdValue: 15000,
    blockConfirmations: 14,
    timestamp: '1 hour ago',
  },
];

export default function OnChainPayoutTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" /> Automated On-Chain Smart Contract Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live blockchain transaction hashes, block confirmations, and instant settlement telemetry.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-purple-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-purple-400" /> Multi-Chain Node Verified
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_TRANSACTIONS.map((tx) => (
          <div
            key={tx.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-purple-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-purple-500/10 text-purple-400 text-[11px] font-mono px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                  {tx.chain}
                </span>
                <span className="text-slate-500 text-xs font-mono">{tx.timestamp}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">Disbursement to {tx.recipientName}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Tx Hash: <span className="text-purple-400">{tx.txHash}</span> • Confirmations: <span className="text-slate-200">{tx.blockConfirmations} Blocks</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${tx.usdValue.toLocaleString()} USD
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Confirmed
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
