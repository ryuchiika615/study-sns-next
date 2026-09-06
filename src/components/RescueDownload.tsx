"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "@/app/free/deadline-rescue/rescue.module.css";

export default function RescueDownload() {
  const [clicked, setClicked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  return <div>
    <a className={styles.button} href="/downloads/ryutter-deadline-rescue.xlsx" download onClick={() => setClicked(true)}>無料シートをダウンロード ↓</a>
    <p className={styles.small}>登録不要・クレジットカード不要 / .xlsx形式</p>
    {clicked && <div className={styles.preview} role="status"><strong>ダウンロードできたら、次は今日の1件。</strong><p>保存先のファイルを開き、見本を自分の課題に置き換えましょう。うまく開けないときは下の「取り込み方」を確認してください。</p><Link className={styles.button} href="/auth/signup?next=%2Fstart%2Frescue">無料登録して、最初の勉強を記録 →</Link><p><Link href="/tasks/import">シートの課題をまとめて取り込む →</Link></p><p><Link href="/auth/login?next=%2Fstart%2Frescue">登録済みの人はこちら →</Link></p><p>シートだけ使ってもOK。ダウンロード完了をこちらで確認しているわけではありません。</p></div>}
    <button type="button" className={styles.shareButton} onClick={async () => {
      try { await navigator.clipboard.writeText(`${window.location.origin}/free/deadline-rescue`); setCopied(true); setShareError(false); }
      catch { setShareError(true); }
    }}>{copied ? "配布ページのURLをコピーしました" : "友達に教える：URLをコピー"}</button>
    {shareError && <p className={styles.small} role="status">コピーできませんでした。ブラウザのアドレス欄からURLをコピーしてください。</p>}
  </div>;
}
