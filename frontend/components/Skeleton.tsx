"use client";

export function Skeleton({
  className = "",
  h = "16",
  w = "full",
}: { className?: string; h?: string; w?: string }) {
  const hMap: Record<string, string> = { xs: "4", sm: "6", md: "16", lg: "24", full: "24" };
  const wMap: Record<string, string> = { sm: "32", md: "64", lg: "128", full: "full" };
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 h-${hMap[h] ?? hMap.md} w-${wMap[w] ?? wMap.full} ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 h-4 mb-2 w-full" />
      ))}
    </div>
  );
}
