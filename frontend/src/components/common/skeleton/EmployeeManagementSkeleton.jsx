import SkeletonBase from './SkeletonBase';

function BreakdownCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <SkeletonBase className="w-11 h-11 rounded-full" />
          <div className="space-y-2">
            <SkeletonBase className="h-3.5 w-28" />
            <SkeletonBase className="h-3 w-20" />
          </div>
        </div>
        <SkeletonBase className="h-6 w-16 rounded-md" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <SkeletonBase className="h-3.5 w-24" />
          <SkeletonBase className="h-3.5 w-16" />
        </div>
        <div className="flex justify-between">
          <SkeletonBase className="h-3.5 w-28" />
          <SkeletonBase className="h-3.5 w-16" />
        </div>
        <div className="flex justify-between">
          <SkeletonBase className="h-3.5 w-20" />
          <SkeletonBase className="h-3.5 w-16" />
        </div>
      </div>
      <div className="h-px bg-gray-200 dark:bg-slate-800 my-4" />
      <div className="flex justify-between items-center">
        <SkeletonBase className="h-3 w-20" />
        <SkeletonBase className="h-6 w-24" />
      </div>
    </div>
  );
}

export default function EmployeeManagementSkeleton() {
  return (
    <main className="p-4 sm:p-8">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
        <div className="w-full md:w-auto">
          <SkeletonBase className="h-5 w-40 rounded-full mb-4" />
          <SkeletonBase className="h-3 w-24 mb-2" />
          <SkeletonBase className="h-9 w-48 mb-2" />
          <SkeletonBase className="h-3 w-56" />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <SkeletonBase className="h-11 flex-1 sm:flex-none sm:w-32 rounded-xl" />
          <SkeletonBase className="h-11 flex-1 sm:flex-none sm:w-36 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <BreakdownCard key={i} />
        ))}
      </div>
    </main>
  );
}