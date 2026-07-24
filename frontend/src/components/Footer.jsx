import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <>
      {/* CTA Section */}
      <section id="pricing" className="px-4 sm:px-6 py-16 sm:py-20 md:py-24">
        <div className="max-w-6xl mx-auto bg-blue-600 rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] p-6 sm:p-10 md:p-16 lg:p-24 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-200 dark:shadow-none">
          
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent)]"></div>

          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 tracking-tight leading-[1.2] sm:leading-[1.1]">
              Stop chasing spreadsheets.
            </h2>

            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-blue-100 mb-8 sm:mb-10 md:mb-12 max-w-xl mx-auto">
              It takes 5 minutes to set up and saves you 10 hours every month.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link to="/auth?mode=signup" className="w-full cursor-pointer sm:w-auto bg-white text-blue-600 text-base sm:text-lg font-bold px-6 sm:px-10 py-3 sm:py-4 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95">
                Start Your Free Trial
              </Link>
            </div>

            <p className="mt-6 sm:mt-8 text-blue-200 text-xs sm:text-sm font-medium">
              Free forever for teams up to 5 employees.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-20 sm:pt-24 md:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto">

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 sm:gap-16 mb-16 sm:mb-20">

            {/* Brand Section */}
            <div className="md:col-span-5 lg:col-span-4">
              <div className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 mb-6 sm:mb-8 text-gray-900 dark:text-white">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-base sm:text-xl shadow-lg shadow-blue-200 dark:shadow-none">
                  P
                </div>
                PaySphere
              </div>

              <p className="text-gray-500 dark:text-slate-400 text-base sm:text-lg leading-relaxed max-w-sm mb-8 sm:mb-10">
                Building the financial infrastructure for modern Indian small businesses.
                Simplify payroll, stay compliant, and empower your team.
              </p>
            </div>

            {/* Links Section */}
            <div className="md:col-span-3 lg:col-span-2">
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-900 dark:text-white mb-6 sm:mb-8">
                Quick Links
              </h4>
              <ul className="space-y-4 text-[15px] sm:text-base text-gray-500 dark:text-slate-400">
                {[
                  { name: "Features", href: "#features" },
                  { name: "Process", href: "#process" },
                  { name: "Pricing", href: "#pricing" },
                  { name: "FAQ", href: "#faq" }
                ].map((link, j) => (
                  <li key={j}>
                    <a href={link.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter Section */}
            <div className="md:col-span-4 lg:col-span-4 lg:col-start-9">
              <h4 className="font-bold text-sm uppercase tracking-widest text-gray-900 dark:text-white mb-6 sm:mb-8">
                Stay in the loop
              </h4>
              <p className="text-gray-500 dark:text-slate-400 text-[15px] sm:text-base mb-6 leading-relaxed">
                Join 2,000+ business owners receiving our weekly payroll & compliance tips.
              </p>
              <form className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-100 dark:shadow-none transition-all active:scale-95 text-sm"
                >
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-center items-center pt-8 sm:pt-10 md:pt-12 border-t border-gray-100 dark:border-slate-800 gap-6 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
              <p className="text-[13px] sm:text-sm text-gray-400 dark:text-slate-500 font-medium">
                © 2026 PaySphere Inc.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}