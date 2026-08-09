import SkeletonBase from './SkeletonBase';

function PayslipRow() {
  return (
    <tr className="border-b border-gray-100 dark:border-slate-800/60">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <SkeletonBase className="h-3.5 w-16" />
        </td>
      ))}
    </tr>
  );
}

export default function EmployeePortalSkeleton() {
  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <SkeletonBase className="h-3 w-28" />
          <SkeletonBase className="h-8 w-48" />
          <SkeletonBase className="h-3 w-40" />
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 flex gap-6">
          <div className="space-y-2">
            <SkeletonBase className="h-3 w-24" />
            <SkeletonBase className="h-5 w-20" />
          </div>
          <div className="space-y-2">
            <SkeletonBase className="h-3 w-20" />
            <SkeletonBase className="h-5 w-16" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
        <SkeletonBase className="h-6 w-40 mb-6" />
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="py-3 px-4">
                  <SkeletonBase className="h-2.5 w-12" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <PayslipRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}