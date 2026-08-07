import SkeletonBase from './SkeletonBase';

function ApprovalRow() {
  return (
    <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-wrap justify-between items-center gap-4 shadow-sm">
      <div className="flex items-center gap-4">
        <SkeletonBase className="w-4 h-4 rounded" />
        <div className="space-y-2">
          <SkeletonBase className="h-4 w-36" />
          <SkeletonBase className="h-3 w-48" />
          <SkeletonBase className="h-3 w-32" />
        </div>
      </div>
      <div className="flex gap-2">
        <SkeletonBase className="h-9 w-24 rounded-lg" />
        <SkeletonBase className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export default function ApprovalsSkeleton() {
  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <SkeletonBase className="h-9 w-64 mb-2" />
          <SkeletonBase className="h-3.5 w-80" />
        </div>
        <div className="text-right space-y-2">
          <SkeletonBase className="h-3 w-28 ml-auto" />
          <SkeletonBase className="h-7 w-32 ml-auto" />
          <SkeletonBase className="h-3 w-24 ml-auto" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
        <SkeletonBase className="h-4 w-24" />
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ApprovalRow key={i} />
        ))}
      </div>
    </div>
  );
}