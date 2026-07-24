import { useEffect, useState } from "react";

export default function Contributors() {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⚠️ CHANGE THESE TO THE TARGET GITHUB REPOSITORY ⚠️
  const REPO_OWNER = "Dev1822";
  const REPO_NAME = "paySphere";

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        // per_page=100 ensures you get up to 100 contributors (enough for scrolling)
        const response = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`
        );
        if (response.ok) {
          const data = await response.json();
          setContributors(data);
        }
      } catch (error) {
        console.error("Error fetching contributors:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, []);

  return (
    <section id="contributors" className="px-4 sm:px-6 py-16 sm:py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-[0.2em] mb-4">
            OPEN SOURCE COMMUNITY
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Built by amazing <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">contributors</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
            PaySphere is powered by the brilliant minds of developers across the globe. 
            Meet the people shaping the future of modern payroll.
          </p>
        </div>

        {/* Scrollable Wrapper Container (Calculated for ~3 rows) */}
        <div className="max-h-[550px] sm:max-h-[650px] overflow-y-auto pr-2 sm:pr-4 pb-4 
          [&::-webkit-scrollbar]:w-2 
          [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:dark:bg-slate-900/50 [&::-webkit-scrollbar-track]:rounded-full 
          [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:dark:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full
          hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 hover:[&::-webkit-scrollbar-thumb]:dark:bg-slate-600 transition-colors">
          
          {/* Contributors Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {loading ? (
              // Loading Skeletons
              [...Array(15)].map((_, i) => (
                <div 
                  key={i} 
                  className="flex flex-col items-center p-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 animate-pulse"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-slate-800 rounded-full mb-4"></div>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-slate-800 rounded mb-2"></div>
                  <div className="h-3 w-16 bg-gray-200 dark:bg-slate-800 rounded"></div>
                </div>
              ))
            ) : contributors.length > 0 ? (
              // Contributor Cards
              contributors.map((contributor, index) => (
                <a
                  key={contributor.id}
                  href={contributor.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col items-center p-6 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-800/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in zoom-in"
                  style={{ animationDelay: `${(index % 15) * 50}ms` }}
                >
                  {/* Avatar with Ring */}
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
                    <img
                      src={contributor.avatar_url}
                      alt={contributor.login}
                      loading="lazy"
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-white dark:border-slate-700 shadow-md group-hover:border-blue-200 dark:group-hover:border-blue-500/50 transition-colors object-cover"
                    />
                  </div>
                  
                  {/* User Info */}
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate w-full text-center">
                    {contributor.login}
                  </h3>
                  <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-400 mt-1 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                    {contributor.contributions} commits
                  </p>
                </a>
              ))
            ) : (
              // Fallback if no contributors found
              <div className="col-span-full text-center py-10 text-gray-500 dark:text-slate-400">
                No contributors found or API limit reached.
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}