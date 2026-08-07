import SkeletonBase from './SkeletonBase';

function PayrollRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 px-6 py-4 border-b border-gray-100 dark:border-slate-800 items-center gap-2">
      <SkeletonBase className="h-3.5 w-3/4" />
      <SkeletonBase className="hidden sm:block h-3.5 w-1/2 mx-auto" />
      <SkeletonBase className="hidden sm:block h-3.5 w-2/3 ml-auto" />
      <SkeletonBase className="hidden sm:block h-3.5 w-2/3 ml-auto" />
      <div className="hidden sm:flex justify-center">
        <SkeletonBase className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export default function PayrollTableSkeleton() {
  return (
    <main className="p-4 sm:p-8">
      <div className="mb-6">
        <SkeletonBase className="h-8 w-56 mb-2" />
        <SkeletonBase className="h-3.5 w-40" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 px-6 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
          <SkeletonBase className="h-3 w-16" />
          <SkeletonBase className="h-3 w-14 mx-auto" />
          <SkeletonBase className="h-3 w-20 ml-auto" />
          <SkeletonBase className="h-3 w-20 ml-auto" />
          <SkeletonBase className="h-3 w-14 mx-auto" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <PayrollRow key={i} />
        ))}
      </div>
    </main>
  );
}