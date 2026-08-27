import { ProCheckoutButton } from "@/components/ProCheckoutButton";
import { FounderCheckoutButton } from "@/components/FounderCheckoutButton";
import Link from "next/link";

const rows = [
  ["学習記録・投稿・交流", "ずっと無料", "ずっと使える"],
  ["タスク管理", "5件まで", "無制限"],
  ["毎日の習慣", "ずっと無料", "ずっと使える"],
  ["教材の進捗管理", "3冊まで", "無制限"],
  ["グループを作成", "1個まで", "無制限"],
  ["試験日から逆算する学習計画", "🔒", "使える"],
  ["詳細分析・AIコーチング", "30日間の基本分析", "任意期間・週次推移・AI"],
  ["復習の記憶保持予測", "🔒", "使える"],
  ["ランキング・グループランキング", "週間", "月間・3か月・年間"],
  ["勉強中のBGM", "🔒", "BGM・YouTube URL再生"],
  ["投稿カードのカスタマイズ", "🔒", "背景画像・柄・Proバッジ"],
  ["ホームテーマ", "🔒", "4種類の自分だけの着せかえ"],
];

const entryMessage: Record<string, string> = {
  "task-limit": "タスクがFREEの上限（5件）に達しました。Proなら無制限に追加できます。",
  "textbook-limit": "教材がFREEの上限（3冊）に達しました。Proなら無制限に追加できます。",
  "analytics": "任意期間の分析と科目別の週次推移はPro限定です。",
  "study-stats": "復習の記憶保持予測・詳細な学習統計はPro限定です。",
  "study-route": "無料の毎日ルートに加えて、Proなら試験日から逆算した計画と長期の定着分析も使えます。",
  "group-today": "毎日の記録に加えて、Proなら試験日から逆算した今週の学習ペースと長期分析も使えます。",
  "ranking-history": "3か月・年間のランキング履歴はPro限定です。",
  "card-background": "投稿カードの背景・柄のカスタマイズはPro限定です。",
  "home-theme": "ホーム画面のカラー着せかえはPro限定です。",
  "group-limit": "FREEではグループを1個まで作成できます。Proなら無制限に作成できます。",
  "bgm": "勉強中のBGM・YouTube URLからの再生はPro限定です。",
  "group-ranking-period": "月間・3か月・年間のグループランキングはPro限定です。",
};

export default function ProPage({ searchParams }: { searchParams?: { from?: string } }) {
  const message = searchParams?.from ? entryMessage[searchParams.from] : null;
  return <div className="mx-auto max-w-2xl space-y-4 p-4">
    <div className="rounded-2xl bg-gradient-to-br from-purple-700 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
      <p className="text-sm font-bold opacity-90"><i className="fas fa-crown mr-1" /> RYUTTER PRO</p>
      <h1 className="mt-1 text-2xl font-bold">目標達成を、毎日の行動に変える。</h1>
      <p className="mt-3 text-sm leading-6 text-purple-50">投稿・交流・基本の記録はずっと無料。Proは、目標に向けて本気で積み上げたい人のための学習環境です。</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-bold sm:grid-cols-4">
        <span className="rounded-lg bg-white/15 p-2">タスク無制限</span><span className="rounded-lg bg-white/15 p-2">グループ無制限</span><span className="rounded-lg bg-white/15 p-2">AIサポート</span><span className="rounded-lg bg-white/15 p-2">自分だけの着せかえ</span>
      </div>
    </div>

    {message && <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-900"><i className="fas fa-lock-open mr-1.5" />{message}</div>}

    <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3"><div><p className="font-bold text-purple-950">Pro 月額240円（税込）</p><p className="mt-1 text-xs text-purple-800">いつでもStripeの契約管理画面から解約できます。</p></div><span className="rounded-full bg-purple-600 px-2.5 py-1 text-[10px] font-bold text-white">人気</span></div>
      <div className="mt-4 space-y-2 text-sm text-purple-950"><p><i className="fas fa-check text-purple-600 mr-2" />タスク・教材・グループを無制限に管理</p><p><i className="fas fa-check text-purple-600 mr-2" />AIカード生成・AI解説・AIコーチ・復習予測</p><p><i className="fas fa-check text-purple-600 mr-2" />BGM・YouTube再生、投稿背景、ホームテーマの着せかえ</p><p><i className="fas fa-check text-purple-600 mr-2" />試験逆算プランと長期間のランキング分析</p></div>
      <div className="mt-4"><ProCheckoutButton /></div>
      <p className="mt-2 text-center text-[10px] text-purple-700">カード情報はリュッターに保存されません</p>
      <p className="mt-3 text-center text-[10px] text-purple-800"><Link href="/terms" className="underline">利用規約</Link><span className="mx-2">・</span><Link href="/privacy" className="underline">プライバシーポリシー</Link><span className="mx-2">・</span><Link href="/tokusho" className="underline">特定商取引法に基づく表記</Link></p>
    </div>

    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="font-black text-amber-950">🎉 X公式アカウント開始記念</p><h2 className="mt-1 text-lg font-black text-amber-950">創設メンバー・永久Pro ¥500</h2><p className="mt-1 text-xs leading-5 text-amber-900">先着30名だけ。月額課金なしで、現在のPro基本機能をずっと使えます。</p></div><span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white">先着30名</span></div>
      <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-amber-950"><p>👑 限定称号「創設メンバー」</p><p>✨ 限定XRフレーム「創設者の星冠」</p><p className="mt-1 text-[10px] text-amber-800">※ AIなど将来追加される外部コストの高い機能は、対象外または利用上限を設ける場合があります。月額Proを利用中の人は、購入後にStripeから月額契約を解約してください。</p></div>
      <div className="mt-4"><FounderCheckoutButton /></div>
    </div>

    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[1fr_90px_90px] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500"><span>機能</span><span>FREE</span><span>PRO</span></div>
      {rows.map(([feature, free, pro]) => <div key={feature} className="grid grid-cols-[1fr_90px_90px] border-t border-gray-100 px-3 py-3 text-sm"><span className="font-medium">{feature}</span><span className="text-gray-500">{free}</span><span className="font-bold text-purple-700">{pro}</span></div>)}
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/profile/edit" className="rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-purple-50 p-4 no-underline"><p className="font-bold text-purple-950">🎨 自分らしい見た目に</p><p className="mt-1 text-xs text-purple-800">投稿カードの背景、称号・アイコン枠、ホーム画面の着せかえを楽しめます。</p></Link>
      <Link href="/bgm" className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4 no-underline"><p className="font-bold text-blue-950">🎵 集中できる環境に</p><p className="mt-1 text-xs text-blue-800">BGMやYouTube URLからの再生を、勉強タイマーと一緒に使えます。</p></Link>
    </div>

    <Link href="/pro/planner" className="block rounded-xl border border-purple-200 bg-purple-50 p-4 no-underline"><p className="font-bold text-purple-900">🎯 試験逆算プラン</p><p className="mt-1 text-xs text-purple-800">試験日までの残り期間を見ながら、毎週の学習ペースを作る。</p></Link>

    <p className="pb-3 text-center text-[11px] text-gray-500">まずはFREEで使い続けてOK。必要になったときだけProを選べます。</p>
  </div>;
}
