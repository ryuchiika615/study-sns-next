import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">アカウントがBANされました</h1>
        <p className="text-gray-500 mb-6">
          このアカウントは利用停止されています。<br />
          詳細は管理者にお問い合わせください。
        </p>
        <Link href="/auth/login" className="text-primary hover:underline text-sm">
          ログインページへ
        </Link>
      </div>
    </div>
  );
}
