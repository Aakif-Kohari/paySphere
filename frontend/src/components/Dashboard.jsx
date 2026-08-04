import dashboardMockup from "../assets/dashboard-mockup.png";
import { getCurrencySymbol, formatCurrency } from '../utils/currency';

export default function Dashboard() {
  const totalPayout = 48251.50;

  return (
    <section id="features" className="px-4 sm:px-6 pb-16 sm:pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">

        {/* Dashboard Image */}
        <div className="relative rounded-2xl sm:rounded-[2.5rem] border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 p-2 sm:p-4 shadow-2xl animate-in fade-in zoom-in duration-1000">
          <img
            src={dashboardMockup}
            alt="PaySphere Dashboard"
            className="rounded-xl sm:rounded-3xl w-full shadow-lg"
          />

          {/* Overlay Card */}
          <div className="absolute bottom-2 right-2 sm:-bottom-10 sm:-right-8 md:-right-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-2xl border border-white/50 dark:border-slate-800/80 w-[85%] sm:w-auto max-w-xs sm:max-w-sm">
            
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                <span className="text-lg sm:text-xl font-bold">{getCurrencySymbol(localStorage.getItem('currency') || 'INR')}</span>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest">
                  Total Net Payout
                </div>
                <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(totalPayout, localStorage.getItem('currency') || 'INR')}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-gray-100 dark:border-slate-800">
              <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-slate-500">
                12 Employees paid
              </span>
              <span className="text-[9px] sm:text-[10px] bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">
                Success
              </span>
            </div>
          </div>
        </div>

        {/* Trusted By */}
        <div className="mt-16 sm:mt-24 md:mt-32 text-center">
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 sm:mb-10">
            TRUSTED BY MODERN TEAMS IN BHARAT
          </p>

          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 md:gap-16 lg:gap-20 opacity-40 grayscale hover:grayscale-0 dark:text-white transition-all duration-500">
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">CAMPPOINT</span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">FASHION</span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">LEADERIT</span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">SIMPLIFY</span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">SKILLS</span>
          </div>
        </div>

      </div>
    </section>
  );
}