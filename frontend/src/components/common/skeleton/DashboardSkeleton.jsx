import SkeletonBase from './SkeletonBase';

function StatCard() {
  return (
    <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <SkeletonBase className="h-3 w-28 mb-3" />
      <SkeletonBase className="h-8 w-40 mb-3" />
      <SkeletonBase className="h-3 w-32" />
    </div>
  );
}

function EmployeeCard() {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SkeletonBase className="w-11 h-11 rounded-full" />
          <div className="space-y-2">
            <SkeletonBase className="h-3.5 w-28" />
            <SkeletonBase className="h-3 w-20" />
          </div>
        </div>
        <SkeletonBase className="h-6 w-16 rounded-md" />
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg space-y-2">
        <SkeletonBase className="h-3 w-20" />
        <SkeletonBase className="h-5 w-24" />
      </div>

      <SkeletonBase className="h-10 w-full rounded-lg" />
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <>
      {/* Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-200 dark:border-slate-800">
        <div>
          <SkeletonBase className="h-3 w-32 mb-2" />
          <SkeletonBase className="h-9 w-48" />
        </div>

        <div className="w-full sm:w-auto mt-4 md:mt-0">
          <SkeletonBase className="h-11 w-full sm:w-56 rounded-xl" />
        </div>

        <div className="flex gap-3 w-full sm:w-auto mt-4 md:mt-0">
          <SkeletonBase className="h-10 flex-1 sm:flex-none sm:w-24 rounded-lg" />
          <SkeletonBase className="h-10 flex-1 sm:flex-none sm:w-28 rounded-lg" />
          <SkeletonBase className="h-10 flex-1 sm:flex-none sm:w-32 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        <StatCard />
        <div className="w-full sm:w-64">
          <StatCard />
        </div>
      </div>

      {/* Search + Export Roster */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <SkeletonBase className="h-5 w-40" />
        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <SkeletonBase className="h-9 flex-1 sm:flex-none sm:w-48 rounded-lg" />
          <SkeletonBase className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <EmployeeCard key={i} />
        ))}
      </div>
    </>
  );
}
