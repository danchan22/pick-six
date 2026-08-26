'use client';

export default function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto px-4 pt-4 w-full animate-pulse">
      <div className="h-10 bg-gray-900 border border-gray-800 rounded-xl w-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-3">
            <div className="h-3 bg-gray-800 rounded w-1/3" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-12 bg-gray-800 rounded-lg" />
              <div className="h-12 bg-gray-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
