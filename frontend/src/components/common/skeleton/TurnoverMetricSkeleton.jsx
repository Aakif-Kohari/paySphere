import SkeletonBase from './SkeletonBase';

function StatCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
      <SkeletonBase className="h-3.5 w-40 mb-3" />
      <SkeletonBase className="h-8 w-20" />
    </div>
  );
}

export default function TurnoverMetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard />
        <StatCard />
        <StatCard />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
        <SkeletonBase className="h-5 w-64 mb-6" />
        <SkeletonBase className="h-75 w-full rounded-lg" />
      </div>
    </div>
  );
}