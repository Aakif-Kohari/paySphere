import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section id="hero" className="pt-28 sm:pt-36 md:pt-44 pb-16 sm:pb-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
          THE SMARTEST PAYROLL FOR BHARAT
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 sm:mb-8 leading-[1.2] sm:leading-[1.1] text-slate-900 dark:text-white animate-in fade-in slide-in-from-bottom-6 duration-700">
          Run your monthly payroll <br className="hidden sm:block" />
          in <span className="text-blue-600 dark:text-blue-400">under 2 minutes.</span>
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg md:text-xl text-gray-500 dark:text-slate-500 max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-900">
          The digital ledger for modern Indian small businesses. Manage attendance,
          compliance, and payouts without the headache.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <Link 
              to="/auth?mode=signup"
              aria-label="Start your free trial"
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-4 rounded-xl shadow-2xl shadow-blue-200 dark:shadow-none transition-all hover:scale-105 active:scale-95"
            >
              Start your free trial
            </Link>
        </div>

      </div>
    </section>
  );
}