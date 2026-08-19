import { LegalPage, LegalSection } from "@/components/LegalPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "特定商取引法に基づく表記 | リュッター" };

const value = (name: string) => process.env[name] || "未設定";

export default function TokushoPage() {
  const configured = ["LEGAL_SELLER_NAME", "LEGAL_ADDRESS", "LEGAL_PHONE", "LEGAL_CONTACT_EMAIL"].every((name) => Boolean(process.env[name]));
  const rows = [
    ["販売事業者", value("LEGAL_SELLER_NAME")], ["運営責任者", value("LEGAL_OPERATOR_NAME")], ["所在地", value("LEGAL_ADDRESS")], ["電話番号", value("LEGAL_PHONE")], ["メールアドレス", value("LEGAL_CONTACT_EMAIL")],
    ["販売価格", "リュッター Pro：月額240円（税込）"], ["販売価格以外の負担", "インターネット接続に必要な通信料等は利用者の負担です。"], ["支払方法", "Stripe Checkoutに表示されるクレジットカード等の決済方法"], ["支払時期", "申込み時および以後の各請求期間の開始時"], ["提供時期", "決済完了後、直ちにPro機能を利用できます。"], ["解約", "リュッター内の「契約を管理する」からStripeの契約管理画面を開いて手続きできます。"], ["返品・返金", "デジタルサービスの性質上、利用開始後の返金は、法令上必要な場合または運営側の明らかな不具合がある場合を除き原則として行いません。"],
  ];
  return <LegalPage title="特定商取引法に基づく表記" updated="2026年8月19日">
    {!configured && <div className="rounded-2xl border border-amber-400 bg-amber-100 p-4 font-bold text-amber-950">本番公開前に、販売事業者情報を設定してください。このページには未設定の項目があります。</div>}
    <LegalSection title="販売条件・事業者情報"><dl className="overflow-hidden rounded-2xl border border-slate-700">{rows.map(([label, content]) => <div key={label} className="border-b border-slate-700 p-4 last:border-b-0 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="font-black text-slate-100">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-300 sm:mt-0">{content}</dd></div>)}</dl></LegalSection>
  </LegalPage>;
}
