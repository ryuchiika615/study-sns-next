export default function Loading() {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-lg w-48" />
      <div className="h-24 bg-gray-200 rounded-xl" />
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  );
}
