import { useState } from "react";

export default function FAQS() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: "Is it really free for teams under 5?",
      a: "Yes. Our mission is to help Bharat's micro-enterprises grow. We offer a fully-featured free tier for teams with up to 5 employees, with no hidden charges or credit card required."
    },
    {
      q: "Is payroll easy to manage without accounting knowledge?",
      a: "Yes, you just need to tell who didn’t come to work and for how many days."
    },
    {
      q: "Can I export data for my CA?",
      a: "Absolutely. You can export one-click reports to your CA."
    }
  ];

  return (
    <section id="faq" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 max-w-4xl mx-auto transition-colors duration-200">
      
      {/* Heading */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-14 md:mb-16 tracking-tight text-slate-900 dark:text-white">
        Frequently Asked Questions
      </h2>

      {/* FAQs */}
      <div className="space-y-3 sm:space-y-4">
        {faqs.map((f, i) => {
          const isOpen = openIndex === i;

          return (
            <div
              key={i}
              className="border border-gray-100 dark:border-slate-800 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-4 sm:py-5 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all"
            >
              <button
                className="flex cursor-pointer justify-between items-center w-full text-left font-semibold text-base sm:text-lg text-gray-900 dark:text-white"
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                {f.q}

                {/* Icon */}
                <span
                  className={`text-xl sm:text-2xl transition-transform duration-300 ${
                    isOpen ? "rotate-45 text-blue-600 dark:text-blue-400" : "text-gray-400"
                  }`}
                >
                  +
                </span>
              </button>

              {/* Answer */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100 mt-3 sm:mt-4" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="text-gray-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}