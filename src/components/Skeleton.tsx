export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  );
}

export function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-3 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-4 my-4 space-y-3">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Skeleton className="h-20 w-full rounded-none" />
        <div className="px-4 pb-4">
          <div className="flex -mt-10 mb-3">
            <Skeleton className="w-20 h-20 rounded-full border-4 border-white" />
          </div>
          <Skeleton className="h-5 w-36 mb-1" />
          <Skeleton className="h-3.5 w-24 mb-3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
