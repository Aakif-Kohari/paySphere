import SkeletonBase from './SkeletonBase';

function StatCard() {
  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
      <SkeletonBase className="h-3 w-28 mb-2" />
      <SkeletonBase className="h-7 w-20" />
    </div>
  );
}

function LoanCard() {
  return (
    <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBase className="h-4 w-32" />
            <SkeletonBase className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonBase className="h-3 w-56" />
          <SkeletonBase className="h-3.5 w-40" />
        </div>
        <div className="flex gap-2">
          <SkeletonBase className="h-8 w-20 rounded-lg" />
          <SkeletonBase className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="mt-4">
        <SkeletonBase className="h-2 w-full rounded-full" />
        <SkeletonBase className="h-3 w-40 mt-2" />
      </div>
    </div>
  );
}

export default function LoansSkeleton() {
  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <SkeletonBase className="h-9 w-72 mb-2" />
          <SkeletonBase className="h-3.5 w-80" />
        </div>
        <SkeletonBase className="h-10 w-36 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard />
        <StatCard />
        <StatCard />
      </div>

      <div className="flex gap-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBase key={i} className="h-8 w-16 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoanCard key={i} />
        ))}
      </div>
    </div>
  );
}
