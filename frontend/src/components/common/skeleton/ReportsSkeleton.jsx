import SkeletonBase from './SkeletonBase';

function SummaryCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonBase className="h-3 w-24 mb-3" />
          <SkeletonBase className="h-7 w-20" />
        </div>
        <SkeletonBase className="w-12 h-12 rounded-full" />
      </div>
    </div>
  );
}

function ChartCard({ pie = false }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <SkeletonBase className="h-5 w-48 mb-5" />
      <div className="h-80 flex items-center justify-center">
        {pie ? (
          <SkeletonBase className="w-52 h-52 rounded-full" />
        ) : (
          <SkeletonBase className="w-full h-full rounded-lg" />
        )}
      </div>
    </div>
  );
}

function TableRow() {
  return (
    <tr className="border-b border-gray-200 dark:divide-slate-700">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <SkeletonBase className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="ml-4 space-y-1.5">
            <SkeletonBase className="h-3.5 w-24" />
            <SkeletonBase className="h-3 w-16" />
          </div>
        </div>
      </td>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <SkeletonBase className="h-3.5 w-16 ml-auto" />
        </td>
      ))}
    </tr>
  );
}

export default function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <SummaryCard key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard />
        <ChartCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard pie />
        <ChartCard />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              {Array.from({ length: 7 }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <SkeletonBase className="h-2.5 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}