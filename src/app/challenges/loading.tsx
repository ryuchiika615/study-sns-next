export default function Loading() {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3 animate-pulse">
      <div className="h-10 bg-gray-200 rounded-lg w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 rounded-xl" />
      ))}
    </div>
  );
}
