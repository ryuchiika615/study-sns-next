import type { Metadata } from "next";
import Link from "next/link";
import styles from "./rescue.module.css";
import RescueDownload from "@/components/RescueDownload";
import RescueSemesterCheckout from "@/components/RescueSemesterCheckout";

export const metadata: Metadata = {
  title: "締切レスキューシート｜大学生の課題管理テンプレ・無料｜RYUTTER",
  description: "課題が重なって、何からやるか決まらない日に。締切順の今日の3件がわかる無料テンプレート。登録不要。Excel・Googleスプレッドシートで使えます。",
  alternates: { canonical: "https://study-sns-next.vercel.app/free/deadline-rescue" },
};

export default function DeadlineRescuePage() {
  return <main className={styles.page}>
    <nav className={styles.nav}><Link href="/">RYUTTER</Link><span>大学生のための無料ツール</span></nav>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>課題に追われる日を、ひとつずつ。</p>
      <h1>締切が多すぎる。<br />まず、何からやる？</h1>
      <p className={styles.lead}>課題と締切を入れるだけで、<strong>今日取り組む3件</strong>が見える。<br />「締切レスキューシート」を無料で配布しています。</p>
      <RescueDownload />
      <div className={styles.ryutterStart}>
        <div><strong>シートの内容を、そのままRYUTTERのタスクに移せます。</strong><p>無料登録で、勉強記録・グループ・通知までひとつにまとめられます。</p></div>
        <Link className={styles.ryutterButton} href="/auth/signup?next=%2Fstart%2Frescue">RYUTTERを無料で始める →</Link>
        <Link className={styles.loginLink} href="/auth/login?next=%2Fstart%2Frescue">登録済みの人はこちら</Link>
      </div>
      <div className={styles.preview} aria-label="今日の3件の表示例。架空の課題です。">
        <div className={styles.previewHeading}><strong>今日の3件</strong><span>表示イメージ</span></div>
        {[['01', '英語レポート', '今日締切', '60分'], ['02', '統計の演習', '明日締切', '30分'], ['03', 'ゼミの資料', '3日後', '90分']].map(([n, task, due, time]) => <div className={styles.task} key={n}><span>{n}</span><strong>{task}</strong><span>{due}</span><span>{time}</span></div>)}
        <p>全部を今日終わらせなくてOK。まずは1件、25分から。</p>
      </div>
    </section>
    <section className={`${styles.section} ${styles.next}`}>
      <p className={styles.eyebrow}>学期全体まで整えたい人へ</p>
      <h2>締切レスキュー 学期版</h2>
      <p>無料版の「今日の3件」に加えて、科目別の課題、試験までの必要時間、週ごとの負荷をまとめて管理できます。買い切り500円で、RYUTTER Proとは別の商品です。</p>
      <RescueSemesterCheckout />
      <p className={styles.small}>購入には無料のRYUTTERアカウントが必要です。決済メールの宛先はStripe画面で入力できます。</p>
      <p className={styles.small}><Link href="/terms">利用規約</Link> ・ <Link href="/tokusho">特定商取引法に基づく表記</Link></p>
    </section>
    <section className={styles.section}>
      <h2>3分で、今日の一歩を決める。</h2>
      <ol className={styles.steps}>
        <li><strong>シートを開く</strong><p>Excelで開くか、Google DriveにアップロードしてGoogleスプレッドシートで開きます。最初の設定はパソコンがおすすめ。</p></li>
        <li><strong>見本を自分の課題に変える</strong><p>「課題入力」に課題名・締切日・残り時間（分）・進み具合を入力。200件まで管理できます。</p></li>
        <li><strong>「今日の3件」を見る</strong><p>未完了の課題を締切の早い順に表示。同じ締切なら入力順。終わった課題を「完了」にすると次の候補が出ます。</p></li>
      </ol>
      <p className={styles.note}>提出時刻や、どれを優先すべきかの最終判断は自分で確認してください。成績や提出の成功を保証するものではありません。課題は本人が取り込み画面で確認して登録したときだけRYUTTERに保存され、自動公開されません。</p>
    </section>
    <section className={`${styles.section} ${styles.next}`}>
      <p className={styles.eyebrow}>計画できた。その次は？</p>
      <h2>ひとりで決めて、<br />仲間と続けよう。</h2>
      <p>RYUTTERは、勉強を記録して仲間と続けるSNS。<br />まずは今日の25分を記録。友達とのグループで、一緒に取り組めます。</p>
      <Link className={styles.button} href="/auth/signup?next=%2Fstart%2Frescue">RYUTTERを無料で始める →</Link>
      <p><Link href="/auth/login?next=%2Fstart%2Frescue">すでに登録済みの人はこちら →</Link></p>
      <p><Link href="/tasks/import">シートの課題をまとめて取り込む →</Link></p>
      <p className={styles.small}>シートだけの利用もOK。登録・基本の学習記録は無料です。</p>
    </section>
    <section className={styles.section}>
      <h2>よくある質問</h2>
      <details><summary>スマホでも使える？</summary><p>Googleスプレッドシートアプリなどで開けます。入力は横スクロールがあるため、初期設定はパソコン、日々の確認は「今日の3件」タブがおすすめです。</p></details>
      <details><summary>Googleスプレッドシートへの取り込み方は？</summary><p>Google Driveへダウンロードしたファイルをアップロードし、Googleスプレッドシートで開きます。必要なら「ファイル」→「Googleスプレッドシートとして保存」を選んでください。</p></details>
      <details><summary>友達に共有してもいい？</summary><p>個人利用・自分用の編集は自由です。友達にはこの配布ページを教えてください。ファイルの再販売はできません。</p></details>
      <details><summary>有料版やProを買わないと使えない？</summary><p>購入不要です。このシートは無料で使えます。学期全体・試験計画まで管理できる500円の学期版は別商品で、RYUTTER Proへの加入は不要です。</p></details>
    </section>
    <footer className={styles.footer}><Link href="/privacy">プライバシー</Link><Link href="/terms">利用規約</Link><span>RYUTTER / 締切レスキュー v1.0</span></footer>
  </main>;
}
