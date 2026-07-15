"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CARDS = [
  { front: "波長450nmと1550nmの光波の周波数を求め、色を述べよ。光速3.0×10^8m/s。", back: "450nm: f = 6.67×10^14Hz = 667THz → 青色\n1550nm: f = 1.94×10^14Hz = 194THz → 赤外線" },
  { front: "文字数500万の英数字文字列を8bit符号化し、1Gbit/sで伝送する時間を求めよ。", back: "総ビット = 500万×8 = 4.0×10^7bit\n伝送時間 = 4.0×10^7/1.0×10^9 = 0.04秒" },
  { front: "光ファイバ通信で1.3μmと1.55μmが多用される理由は？", back: "1.3μm：波長分散小→高速伝送向き\n1.55μm：伝送損失小→長距離伝送向き" },
  { front: "カットオフ波長1250nmのSMFに緑色レーザ光を伝送するとどうなるか？", back: "マルチモード伝搬となり、モード分散が発生する。" },
  { front: "半導体レーザ光とLED光の性質の違いを述べよ。", back: "LD：誘導放出、狭スペクトル、高指向性、強度一定\nLED：自然放出、広スペクトル、低指向性、強度が雑音状" },
  { front: "LDとLEDの駆動電流-光出力特性の差異を述べよ。", back: "LD：しきい値電流以上で急増\nLED：電流に比例して増加" },
  { front: "IM/DD方式の伝送特性図から分かることと、高速化による伝送限界の変化を述べよ。", back: "低速→損失制限、高速→波長分散による分散制限が支配的" },
  { front: "分散補償ファイバによる波長分散補償の原理を述べよ。", back: "逆分散で波長分散を打ち消す。" },
  { front: "WDM伝送技術の概要を説明せよ。", back: "波長の異なる光を1本の光ファイバで同時伝送する技術。" },
  { front: "光ファイバ増幅器をWDM伝送に用いる利点は？", back: "複数波長の光信号を同時増幅できる。" },
  { front: "PONについて簡単に説明せよ。", back: "光スプリッタで1本の光ファイバを複数利用者が共有する方式。" },
  { front: "GE-PON/10GE-PONでイーサネットフレーム以外のサービスを提供する方法は？", back: "通信とは異なる波長を利用する。" },
  { front: "BPSKとQPSKのコンスタレーションについて、BPSKが雑音耐性に優れる理由は？", back: "BPSKは信号点間距離が大きく、雑音による誤判定が起きにくいため。" },
  { front: "QPSKとはどのような通信方式か？", back: "搬送波の位相を4値に変化させる変調方式（1シンボル2bit）。" },
  { front: "波長1550nm、10Gb/sのOOK信号でビット1の光パワー10μW。平均光子数は？", back: "T=10^-10s, E=10^-15J, Ep=1.28×10^-19J\nN = 10^-15/1.28×10^-19 ≈ 7800個" },
  { front: "光ファイバを構造によって分類し説明せよ。", back: "SI型：屈折率が急変\nGI型：屈折率が徐々に変化" },
  { front: "SMFとMMFの違いを説明せよ。", back: "SMF：コア径小、1モード、モード分散なし\nMMF：コア径大、多モード、モード分散あり" },
  { front: "マルチモードファイバのモード分散について説明せよ。", back: "複数の経路で伝搬時間が異なり、パルスが広がる。" },
  { front: "MMFによる長距離伝送が難しい理由は？", back: "モード分散が発生するため。" },
  { front: "長距離・高速伝送に用いる光波の波長について説明せよ。", back: "高速→波長分散の小さい1.3μm帯\n長距離→伝送損失の小さい1.55μm帯" },
  { front: "光ファイバ通信で1.3μm・1.55μmが多用される理由をファイバ特性の観点から述べよ。", back: "1.3μm帯：波長分散が小さい\n1.55μm帯：伝送損失が小さい" },
  { front: "SMFによる高速・長距離通信の問題点を2つ挙げよ。", back: "損失：光パワー減衰で距離制限\n波長分散：パルス広がりで高速伝送が困難" },
  { front: "光コネクタでコアを完全接続する工夫は？", back: "PC研磨やAPC研磨を行い、接続損失や反射を低減。" },
  { front: "フォトダイオードの機能と検出電流の比例関係を述べよ。", back: "光信号→電気信号に変換\n検出電流は光パワーに比例" },
  { front: "PIN-PDとAPDの違いを説明せよ。", back: "PIN：増倍部なし\nAPD：増倍部ありで高感度" },
  { front: "IM/DD方式とは？簡単な構成図を示せ。", back: "光強度変調→直接検出方式\nレーザ→変調器→光ファイバ→PD" },
  { front: "ショット雑音制限について説明せよ。", back: "光の粒子性によるショット雑音で伝送性能が制限される。" },
  { front: "損失制限と分散制限をそれぞれ説明せよ。", back: "損失制限：光パワー減衰で距離制限\n分散制限：波長分散によるパルス広がりで速度・距離制限" },
  { front: "光ファイバ増幅器について説明せよ。", back: "光信号を電気変換せずに増幅する装置。" },
  { front: "5本のファイバ、各96波WDM、10Gb/s/波の海底システムの総容量は？", back: "1本: 96×10G = 9.6×10^11 b/s\n5本: 4.8×10^12 b/s = 4.8Tb/s" },
  { front: "フォトニックネットワークでWDMが利用される理由は？", back: "波長を利用し、ルーティングなどを光のまま高速に行うため。" },
  { front: "シンボルレート25GBaudのQPSKの伝送速度は？", back: "25×10^9×2 = 50Gbit/s" },
  { front: "10Gbit/s、BER=10^-10のシステムの1時間あたりの平均誤りビット数は？", back: "総ビット=10×10^9×3600=3.6×10^13\n誤り=3.6×10^13×10^-10=3600bit" },
];

export default function ImportOpticalPage() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ deck_id: string; cards_created: number } | null>(null);
  const [error, setError] = useState("");

  const handleImport = async () => {
    setImporting(true);
    setError("");
    const res = await fetch("/api/study/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_name: "光通信工学", cards: CARDS }),
    });
    setImporting(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "インポート失敗");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full mx-4 text-center space-y-4">
        <h1 className="text-lg font-bold">光通信工学 カードインポート</h1>
        <p className="text-sm text-gray-500">{CARDS.length}枚のカードをインポートします</p>
        {!result ? (
          <>
            <button onClick={handleImport} disabled={importing}
              className="w-full bg-primary text-white font-bold rounded-full py-3 text-sm disabled:opacity-50 cursor-pointer">
              {importing ? "インポート中..." : "インポート開始"}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 text-green-700 rounded-lg p-3 text-sm">
              ✅ {result.cards_created}枚のカードを「光通信工学」デッキに作成しました
            </div>
            <button onClick={() => router.push(`/study/${result.deck_id}`)}
              className="w-full bg-primary text-white font-bold rounded-full py-3 text-sm cursor-pointer">
              デッキを見る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
