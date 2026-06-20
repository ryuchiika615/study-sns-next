"use client";

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-3">😵</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
        <p className="text-gray-500 text-sm mb-4">表示中にエラーが発生しました</p>
        <button onClick={reset}
          className="bg-primary text-white rounded-full px-5 py-2 text-sm font-bold cursor-pointer hover:bg-blue-600 transition">
          再読み込み
        </button>
      </div>
    </div>
  );
}
