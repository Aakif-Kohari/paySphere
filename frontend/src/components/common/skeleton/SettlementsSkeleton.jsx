import SkeletonBase from './SkeletonBase';

function SettlementCard() {
  return (
    <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonBase className="h-4 w-32" />
            <SkeletonBase className="h-5 w-24 rounded-full" />
          </div>
          <SkeletonBase className="h-3 w-48" />
          <SkeletonBase className="h-3.5 w-64" />
        </div>
        <SkeletonBase className="h-8 w-32 rounded-lg" />
      </div>
    </div>
  );
}

export default function SettlementsSkeleton() {
  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <SkeletonBase className="h-9 w-72 mb-2" />
          <SkeletonBase className="h-3.5 w-96" />
        </div>
        <SkeletonBase className="h-10 w-28 rounded-lg" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBase key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <SettlementCard key={i} />
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-6">
        <SkeletonBase className="h-9 w-24 rounded-lg" />
        <SkeletonBase className="h-9 w-9 rounded-lg" />
        <SkeletonBase className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}
