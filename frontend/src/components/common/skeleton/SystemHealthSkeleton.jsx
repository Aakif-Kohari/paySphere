import SkeletonBase from './SkeletonBase';

function MetricCard() {
  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <SkeletonBase className="h-3 w-32" />
        <SkeletonBase className="w-3 h-3 rounded-full" />
      </div>
      <SkeletonBase className="h-7 w-24 mb-2" />
      <SkeletonBase className="h-3 w-36 mb-1" />
      <SkeletonBase className="h-3 w-28" />
    </div>
  );
}

export default function SystemHealthSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard />
      <MetricCard />
      <MetricCard />
    </div>
  );
}