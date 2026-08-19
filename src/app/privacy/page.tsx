import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata = { title: "プライバシーポリシー | リュッター" };

export default function PrivacyPage() {
  return <LegalPage title="プライバシーポリシー" updated="2026年8月19日">
    <LegalSection title="1. 取得する情報"><p>アカウント情報、プロフィール情報、投稿・学習記録、グループに関する情報、問い合わせ内容、サービス利用に必要な技術情報を取得します。</p></LegalSection>
    <LegalSection title="2. 利用目的"><p>サービス提供、本人確認、不正利用防止、問い合わせ対応、機能改善、重要なお知らせのために利用します。</p></LegalSection>
    <LegalSection title="3. 決済情報"><p>Proプランの決済はStripe Checkoutを使用します。リュッターはクレジットカード番号を保存しません。決済、請求、契約管理のためにStripeが情報を取り扱います。</p></LegalSection>
    <LegalSection title="4. 外部サービス"><p>認証・データ保存にSupabase、配信にVercel、決済にStripeを利用します。X連携を利用する場合は、利用者の操作によりXの認証機能を利用します。</p></LegalSection>
    <LegalSection title="5. 公開範囲"><p>公開掲示板の内容は他の利用者に表示されます。非公開グループ内の本文はグループ外へ公開されません。ホームの活動記録では、グループ投稿の本文を表示せず、科目・種別・時間のみを表示します。</p></LegalSection>
    <LegalSection title="6. 開示・削除等"><p>登録情報の確認・修正・削除に関するご相談は、特定商取引法に基づく表記の連絡先までご連絡ください。法令上の保存義務がある情報を除き、合理的な範囲で対応します。</p></LegalSection>
  </LegalPage>;
}
