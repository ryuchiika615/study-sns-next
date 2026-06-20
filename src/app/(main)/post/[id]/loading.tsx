export default function Loading() {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3 animate-pulse">
      <div className="h-48 bg-gray-200 rounded-xl" />
      <div className="h-10 bg-gray-200 rounded-lg" />
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 rounded-lg" />
        <div className="h-8 bg-gray-200 rounded-lg" />
        <div className="h-8 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}
