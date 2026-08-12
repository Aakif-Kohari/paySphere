import styles from './Steps.module.css';
export default function Steps() {
  return (
    <section id="process" className={styles.container}>
      <div className="max-w-5xl mx-auto text-center">

        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 tracking-tight text-slate-900 dark:text-white">
          Payroll in three simple steps.
        </h2>

        {/* Subtext */}
        <p className="text-base sm:text-lg text-gray-500 dark:text-slate-500 mb-10 sm:mb-16 max-w-xl mx-auto">
          We stripped away the complexity of traditional payroll systems.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
          {[
            { icon: "👥", title: "Add your Team", color: "bg-blue-50 dark:bg-blue-950/40" },
            { icon: "📋", title: "Log Daily Updates", color: "bg-indigo-50 dark:bg-indigo-950/40" },
            { icon: "💸", title: "Click and Payout", color: "bg-violet-50 dark:bg-violet-950/40" }
          ].map((step, i) => (
            <div
              key={i}
              className="group p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
            >
              <div
                className={`w-12 h-12 sm:w-16 sm:h-16 ${step.color} rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-4 sm:mb-6 group-hover:scale-110 transition-transform`}
              >
                {step.icon}
              </div>

              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-slate-900 dark:text-white">
                {step.title}
              </h3>

              <p className="text-gray-500 dark:text-slate-500 leading-relaxed text-sm sm:text-[15px]">
                Import your existing team in seconds. Our automated system handles the migration.
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}