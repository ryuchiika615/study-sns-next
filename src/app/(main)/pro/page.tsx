import ProPlanCard from "@/components/ProPlanCard";

const rows = [
  ["学習記録・投稿・交流", "ずっと無料", "ずっと使える"],
  ["タスク管理", "5件まで", "無制限"],
  ["毎日の習慣", "ずっと無料", "ずっと使える"],
  ["教材の進捗管理", "3冊まで", "無制限"],
  ["長期の分析・コーチング", "基本表示", "今後Proに追加"],
];

export default function ProPage() {
  return <div className="mx-auto max-w-2xl space-y-4 p-4">
    <div className="rounded-2xl bg-gradient-to-br from-purple-700 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
      <p className="text-sm font-bold opacity-90">RYUTTER PRO</p>
      <h1 className="mt-1 text-2xl font-bold">勉強を、続く仕組みに。</h1>
      <p className="mt-3 text-sm leading-6 text-purple-50">学ぶ・記録する・仲間と続ける。基本機能は無料のまま、Proは本気の目標管理を支えます。</p>
    </div>

    <ProPlanCard />

    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[1fr_90px_90px] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500"><span>機能</span><span>FREE</span><span>PRO</span></div>
      {rows.map(([feature, free, pro]) => <div key={feature} className="grid grid-cols-[1fr_90px_90px] border-t border-gray-100 px-3 py-3 text-sm"><span className="font-medium">{feature}</span><span className="text-gray-500">{free}</span><span className="font-bold text-purple-700">{pro}</span></div>)}
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-bold">Proの決済は準備中です</p>
      <p className="mt-1 text-xs leading-5">現在は運営からの無料付与でProを利用できます。有料開始時は、この画面から安全に申し込めるようにします。</p>
    </div>
  </div>;
}
