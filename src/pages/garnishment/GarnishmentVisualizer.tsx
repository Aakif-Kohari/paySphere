import React, { useState, useMemo } from 'react';
import { GarnishmentService } from './GarnishmentService';

export default function GarnishmentVisualizer() {
  const [service] = useState(() => new GarnishmentService());
  const [grossEarnings, setGrossEarnings] = useState<number>(4500);
  const [mandatoryDeductions, setMandatoryDeductions] = useState<number>(1200);

  const orders = service.getState().getOrders();
  const results = useMemo(() => {
    return service.calculateGarnishmentWithholding(grossEarnings, mandatoryDeductions, orders);
  }, [service, grossEarnings, mandatoryDeductions, orders]);

  const disposableEarnings = Math.max(0, grossEarnings - mandatoryDeductions);
  const totalWithheld = results.reduce((acc, curr) => acc + curr.actualWithheldUsd, 0);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-full border border-rose-500/30 uppercase tracking-wider">
              CCPA Wage Garnishment Compliance
            </span>
            <span className="text-slate-400 text-xs font-mono">v7.1.0 • Title III CCPA Caps (50%-65%)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-amber-400">
            Child Support & Wage Garnishment Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Multi-order priority withholding allocation, disposable earnings calculator, and Consumer Credit Protection Act (CCPA) statutory cap enforcement.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Disposable Earnings</div>
          <div className="text-2xl font-bold text-rose-300">${disposableEarnings.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Gross (${grossEarnings}) - Mandatory (${mandatoryDeductions})</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Total Garnishment Withheld</div>
          <div className="text-2xl font-bold text-amber-400">${totalWithheld.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Priority Order Withholding</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Net Take-Home Pay</div>
          <div className="text-2xl font-bold text-emerald-400">${(disposableEarnings - totalWithheld).toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Post-Garnishment Balance</div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Garnishment Order Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="py-3 px-3">Order Type</th>
                <th className="py-3 px-3">CCPA Cap ($USD)</th>
                <th className="py-3 px-3">Actual Withheld ($USD)</th>
                <th className="py-3 px-3">Remaining Balance</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {results.map(r => (
                <tr key={r.orderId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 text-slate-200 font-bold">{r.orderType}</td>
                  <td className="py-3 px-3 text-slate-400">${r.maxCcpaCapUsd}</td>
                  <td className="py-3 px-3 text-amber-400 font-bold">${r.actualWithheldUsd}</td>
                  <td className="py-3 px-3 text-rose-300">${r.remainingOrderBalanceUsd}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`px-2 py-0.5 text-xs rounded ${r.isCappedByCcpa ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {r.isCappedByCcpa ? 'CAPPED BY CCPA' : 'FULLY WITHHELD'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
