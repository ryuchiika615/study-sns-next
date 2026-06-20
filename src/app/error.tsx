"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-blue-900 p-4">
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">💥</p>
        <h1 className="text-2xl font-bold text-red-400 mb-2">エラーが発生しました</h1>
        <p className="text-gray-300 text-sm mb-6">予期しないエラーが発生しました。もう一度お試しください。</p>
        <button onClick={reset}
          className="inline-block bg-yellow-600 text-white font-bold rounded-full px-6 py-2.5 hover:bg-yellow-500 transition cursor-pointer">
          もう一度試す
        </button>
      </div>
    </div>
  );
}
