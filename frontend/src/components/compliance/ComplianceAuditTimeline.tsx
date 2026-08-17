import React from 'react';
import { ShieldCheck, CheckCircle2, Clock, FileCheck } from 'lucide-react';

interface StatutoryFilingAudit {
  id: string;
  formCode: string;
  authorityName: string;
  jurisdictionCountry: string;
  remittanceUSD: number;
  filedTimestamp: string;
  acknowledgmentRef: string;
}

const RECENT_FILINGS: StatutoryFilingAudit[] = [
  {
    id: 'flg-1',
    formCode: 'IRS Form 941 (Q2)',
    authorityName: 'Internal Revenue Service (IRS)',
    jurisdictionCountry: 'United States',
    remittanceUSD: 1250000,
    filedTimestamp: '25 mins ago',
    acknowledgmentRef: 'ACK-941-20260817-9921',
  },
  {
    id: 'flg-2',
    formCode: 'HMRC Real Time Information (RTI)',
    authorityName: 'HM Revenue & Customs',
    jurisdictionCountry: 'United Kingdom',
    remittanceUSD: 420000,
    filedTimestamp: '2 hours ago',
    acknowledgmentRef: 'RTI-UK-8832-AX',
  },
  {
    id: 'flg-3',
    formCode: 'Lohnsteuer-Anmeldung (Monthly)',
    authorityName: 'Bundeszentralamt für Steuern',
    jurisdictionCountry: 'Germany',
    remittanceUSD: 310000,
    filedTimestamp: '4 hours ago',
    acknowledgmentRef: 'BZST-DE-44109-8',
  },
];

export default function ComplianceAuditTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-rose-400" /> Automated Statutory Tax Remittance Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live tax authority filing acknowledgments and cryptographic submission receipts.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-rose-300 font-semibold font-mono">
          <FileCheck className="w-4 h-4 text-rose-400" /> IRS & HMRC Gateway Verified
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_FILINGS.map((filing) => (
          <div
            key={filing.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-rose-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-rose-500/10 text-rose-400 text-[11px] font-mono px-2 py-0.5 rounded border border-rose-500/20 font-bold">
                  {filing.formCode}
                </span>
                <span className="text-slate-500 text-xs font-mono">{filing.filedTimestamp}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{filing.authorityName} ({filing.jurisdictionCountry})</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Ref Code: <span className="text-slate-200">{filing.acknowledgmentRef}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${filing.remittanceUSD.toLocaleString()} USD
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Filed
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
