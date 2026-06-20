import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-blue-900 p-4">
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">📚</p>
        <h1 className="text-3xl font-bold text-yellow-500 mb-2">404</h1>
        <p className="text-gray-300 mb-6">ページが見つかりませんでした</p>
        <Link href="/"
          className="inline-block bg-yellow-600 text-white font-bold rounded-full px-6 py-2.5 hover:bg-yellow-500 transition">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
