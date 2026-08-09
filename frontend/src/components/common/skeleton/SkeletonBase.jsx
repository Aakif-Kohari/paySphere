export default function SkeletonBase({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-slate-800 ${className}`}
    />
  );
}