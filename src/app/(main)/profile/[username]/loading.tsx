export default function Loading() {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-200 rounded w-48" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="h-16 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-48 bg-gray-200 rounded-xl" />
      <div className="h-24 bg-gray-200 rounded-xl" />
      <div className="h-24 bg-gray-200 rounded-xl" />
    </div>
  );
}
