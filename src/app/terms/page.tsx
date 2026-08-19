import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata = { title: "利用規約 | リュッター" };

export default function TermsPage() {
  return <LegalPage title="利用規約" updated="2026年8月19日">
    <LegalSection title="1. サービスについて"><p>リュッターは、学習・運動の記録、投稿、グループでの交流を支援するサービスです。本サービスを利用した時点で、本規約に同意したものとします。</p></LegalSection>
    <LegalSection title="2. アカウント"><p>利用者は、登録情報を正確に保ち、アカウントを自身の責任で管理します。第三者による不正利用が疑われる場合は、速やかにお問い合わせください。</p></LegalSection>
    <LegalSection title="3. 投稿・グループでの禁止事項"><p>法令違反、第三者の権利やプライバシーを侵害する行為、誹謗中傷、なりすまし、サービス運営を妨げる行為は禁止します。公開掲示板の投稿は全利用者に表示されます。非公開グループの投稿は、そのグループのメンバーに表示されます。</p></LegalSection>
    <LegalSection title="4. Proプランと継続課金"><p>Proプランは月額240円（税込）の継続課金です。Stripe Checkoutでの申込み完了後に利用できます。解約するまで各請求期間の開始時に自動更新されます。解約は、リュッター内の「契約を管理する」からStripeの契約管理画面を開いて行えます。</p></LegalSection>
    <LegalSection title="5. 返金"><p>デジタルサービスの性質上、利用開始後の利用料金は、法令上必要な場合またはリュッター側の明らかな不具合がある場合を除き、原則として返金しません。</p></LegalSection>
    <LegalSection title="6. サービスの変更・停止"><p>運営上必要な場合、サービス内容の変更または提供停止を行うことがあります。重大な変更がある場合は、サービス内などでお知らせします。</p></LegalSection>
    <LegalSection title="7. お問い合わせ"><p>販売事業者・連絡先は「特定商取引法に基づく表記」に掲載しています。</p></LegalSection>
  </LegalPage>;
}
