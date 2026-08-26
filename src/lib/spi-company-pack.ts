export type SpiCompanyCard = {
  front: string;
  back: string;
  options: string[];
  correct_answer: number;
  tags: string[];
  card_type: "multiple_choice";
};

export const SPI_TARGET_COMPANIES = [
  "JR東日本",
  "伊藤忠テクノソリューションズ（CTC）",
  "NTTデータ",
  "NTTドコモソリューションズ",
  "東京海上日動システムズ",
  "農中情報システム",
  "NEC",
  "NECフィールディング",
  "NECソリューションイノベータ",
  "NECネッツエスアイ",
  "SCSK",
  "TIS",
  "日立システムズ",
] as const;

const choice = (front: string, back: string, options: string[], correct_answer: number, company: string, field: "言語" | "非言語"): SpiCompanyCard => ({
  front,
  back,
  options,
  correct_answer,
  tags: ["SPI形式", field, company, "オリジナル問題"],
  card_type: "multiple_choice",
});

/**
 * Copyright-safe original questions. They practise common SPI-style skills,
 * but they are not copied past questions and do not claim an employer's test format.
 */
function createSpiCardSet(company: string, index: number, round: number): SpiCompanyCard[] {
  const n = index + 1 + round * 3;
  const vocab = [
    ["改善策を講じる", "講じる", "方法をとる"], ["周知を徹底する", "徹底する", "すみずみまで行き渡らせる"],
    ["懸念を払拭する", "払拭する", "不安を取り除く"], ["責務を果たす", "果たす", "役目を十分に行う"],
    ["方針を踏襲する", "踏襲する", "前例に従う"], ["課題を顕在化させる", "顕在化させる", "はっきり表面化させる"],
    ["見解を述べる", "述べる", "考えを説明する"], ["根拠を示す", "根拠", "判断の理由"],
    ["手順を簡略化する", "簡略化する", "より簡単にする"], ["規模を拡大する", "拡大する", "大きく広げる"],
  ][round];
  const fill = [
    ["意見を（　）して結論をまとめる。", "集約"], ["関係者と日程を（　）して会議を決める。", "調整"],
    ["仮説をデータで（　）する。", "検証"], ["原因を（　）し、再発防止策を考える。", "分析"],
    ["業務の手順を（　）して共有する。", "標準化"], ["必要な情報を（　）して一覧にした。", "整理"],
    ["利用者の声を（　）し、改善案へ反映する。", "把握"], ["複数案を（　）して最適な案を選ぶ。", "比較"],
    ["成果を数値で（　）する。", "評価"], ["目標までの進み具合を（　）する。", "管理"],
  ][round];
  const passage = [
    ["新しい仕組みを導入するだけでは成果は出ない。目的を共有し、利用後に検証して改善を続けて初めて、仕組みは組織に定着する。", "仕組みは導入後の共有・検証・改善で定着する"],
    ["短い会議でも、事前に論点を共有すれば参加者は準備できる。結果として議論が深まり、決定までの時間も短くなる。", "事前の論点共有は会議の質と効率を高める"],
    ["数字は判断を助けるが、数字だけでは利用者の困りごとまでは分からない。定量情報と現場の声を組み合わせる必要がある。", "判断には数値と現場の声の両方が必要である"],
    ["失敗を隠す組織では、同じ問題が繰り返されやすい。小さな失敗も共有して学ぶことが、長期的な品質向上につながる。", "失敗の共有と学習が品質向上につながる"],
    ["急いで答えを出すことが常に良いとは限らない。前提が曖昧なままの結論は、後で大きな手戻りを生むことがある。", "前提を確認してから結論を出すことが重要である"],
    ["専門性が高い説明ほど、相手の知識に合わせて言葉を選ぶ必要がある。正確さと分かりやすさは対立するものではない。", "相手に合わせた説明は正確さと両立できる"],
    ["計画は予定どおりに進めるためだけのものではない。変化が起きたときに優先順位を見直す基準にもなる。", "計画は変化時の優先順位を見直す基準にもなる"],
    ["個人の工夫を共有すると、チーム全体の仕事が速くなることがある。再現できる形にして残すことが大切だ。", "個人の工夫は再現可能な形で共有すると価値が高まる"],
    ["顧客の要望をすべて受け入れることが最善とは限らない。目的と影響を整理し、優先順位をつける必要がある。", "要望は目的と影響を踏まえて優先順位をつけるべきだ"],
    ["学習では、難しい問題だけを続けると進捗を実感しにくい。基礎の確認と難問演習を組み合わせる方が継続しやすい。", "基礎確認と難問演習を組み合わせると継続しやすい"],
  ][round];
  const relationship = [
    ["抽象：具体", "全体：部分"], ["原因：結果", "問題：解決"], ["設計：実装", "計画：実行"],
    ["入力：出力", "質問：回答"], ["規則：例外", "原則：特例"], ["比較：選択", "分析：判断"],
    ["仮説：検証", "案：評価"], ["要求：仕様", "目的：手段"], ["記録：保存", "経験：学習"], ["開始：完了", "準備：実行"],
  ][round];
  const usage = [
    ["念のため", "念のため、送信前に添付ファイルを確認した。"], ["あらかじめ", "あらかじめ、会議の論点を参加者に共有した。"],
    ["一概に", "一概に、短い会議の方がよいとは言えない。"], ["必ずしも", "必ずしも、経験年数だけで判断できるわけではない。"],
    ["あえて", "あえて、利用者が迷いやすい点を先に説明した。"], ["おおむね", "予定はおおむね計画どおりに進んでいる。"],
    ["ひときわ", "その提案は他の案よりひときわ具体的だった。"], ["かえって", "急いで確認を省くと、かえって時間がかかる。"],
    ["もっぱら", "この資料はもっぱら社内共有に使う。"], ["あくまで", "この数値はあくまで見込みであり、確定値ではない。"],
  ][round];
  const before = 500 + n * 50;
  const after = Math.round(before * 0.96);
  const speed = 45 + (n % 4) * 5;
  const hours = 2 + (n % 3);
  const distance = speed * hours;
  const ratioA = 2 + (n % 3);
  const ratioB = 5 + (n % 4);
  const ratioUnit = 120;
  const participants = 5 + (n % 3);
  const combinations = (participants * (participants - 1)) / 2;

  return [
    choice(
      `【${company}｜言語】\n「${vocab[0]}」の「${vocab[1]}」と最も近い意味はどれか。`,
      `正解：${vocab[2]}\n\n語句の問題では、単語だけでなく慣用的な組み合わせの中で意味を捉えます。「${vocab[0]}」の文脈では「${vocab[2]}」が最適です。`,
      [vocab[2], "議論をやめる", "記録を残す", "人に任せる"], 0, company, "言語"
    ),
    choice(
      `【${company}｜言語】\n次の文の（　）に最も適切な語を入れよ。\n「${fill[0]}」`,
      `正解：${fill[1]}\n\n文全体の目的・対象との自然なつながりを確認します。この文では「${fill[1]}」が最も自然で、意味も通ります。`,
      [fill[1], "放置", "省略", "対立"], 0, company, "言語"
    ),
    choice(
      `【${company}｜言語】\n次の文章の要旨として最も適切なものはどれか。\n「${passage[0]}」`,
      `正解：${passage[1]}\n\n要旨は文章全体の主張です。一部の例だけでなく、筆者が最も伝えたい結論を含む選択肢を選びます。`,
      [passage[1], "新しい方法は必ず成果を出す", "検証は導入前にだけ行う", "関係者との共有は不要である"], 0, company, "言語"
    ),
    choice(
      `【${company}｜言語】\n「${relationship[0]}」と最も近い関係にあるものはどれか。`,
      `正解：${relationship[1]}\n\n二語の関係は、単語の意味ではなく「前の語と後ろの語がどう結びつくか」を見ます。「${relationship[0]}」と同じ関係になるのは「${relationship[1]}」です。`,
      [relationship[1], "開始：終了", "賛成：反対", "高い：低い"], 0, company, "言語"
    ),
    choice(
      `【${company}｜言語】\n次のうち、「${usage[0]}」の使い方として最も適切なものはどれか。`,
      `正解：${usage[1]}\n\n副詞・接続語は、その語が表す状況と文脈が合うかで判断します。SPIでは置かれた場面まで想像して選びます。`,
      [usage[1], `${usage[0]}、会議は昨日終わった。`, `${usage[0]}、数字は三つある。`, `${usage[0]}、改善案に反対した。`], 0, company, "言語"
    ),
    choice(
      `【${company}｜非言語】\nあるサービスの月額料金を${before}円から20%値上げし、その後20%値下げした。最終的な料金はいくらか。`,
      `正解：${after}円\n\n値上げ後は ${before}×1.2、さらに20%値下げなので ×0.8 です。よって ${before}×1.2×0.8＝${after}。同じ20%でも基準となる金額が違うため、元の料金には戻りません。`,
      [`${after}円`, `${before}円`, `${before + Math.round(before * 0.2)}円`, `${before - Math.round(before * 0.2)}円`], 0, company, "非言語"
    ),
    choice(
      `【${company}｜非言語】\n${company}の研修会場まで${distance}kmある。時速${speed}kmで一定の速さで移動すると、何時間かかるか。`,
      `正解：${hours}時間\n\n時間＝距離÷速さ。${distance}÷${speed}＝${hours} です。速さの問題は、単位を「km」「時間」でそろえてから計算します。`,
      [`${hours}時間`, `${hours + 1}時間`, `${Math.max(1, hours - 1)}時間`, `${hours * 2}時間`], 0, company, "非言語"
    ),
    choice(
      `【${company}｜非言語】\n${participants}人の候補者から、2人を選んでペアを1組つくる。選び方は何通りか。`,
      `正解：${combinations}通り\n\n組合せなので順番は区別しません。${participants}C2＝${participants}×${participants - 1}÷2＝${combinations}。順列との違いは「AとB」と「BとA」を同じ組と数える点です。`,
      [`${combinations}通り`, `${participants * (participants - 1)}通り`, `${participants}通り`, `${participants - 1}通り`], 0, company, "非言語"
    ),
    choice(
      `【${company}｜非言語】\n赤いカード3枚、青いカード2枚が入った箱から、1枚を無作為に取り出す。赤いカードを引く確率はどれか。`,
      "正解：3/5\n\n確率＝条件に合う場合の数÷全体の場合の数。赤は3枚、全体は5枚なので 3÷5＝3/5 です。",
      ["3/5", "2/5", "1/2", "3/2"], 0, company, "非言語"
    ),
    choice(
      `【${company}｜非言語】\nプロジェクトAとBにかかる工数の比は ${ratioA}:${ratioB} である。合計を ${(ratioA + ratioB) * ratioUnit}時間とすると、Aの工数は何時間か。`,
      `正解：${ratioA * ratioUnit}時間\n\n比の1単位は ${(ratioA + ratioB) * ratioUnit}÷(${ratioA}+${ratioB})＝${ratioUnit}時間です。Aは${ratioA}単位なので ${ratioA}×${ratioUnit}＝${ratioA * ratioUnit}時間です。`,
      [`${ratioA * ratioUnit}時間`, `${ratioB * ratioUnit}時間`, `${(ratioA + ratioB) * ratioUnit}時間`, `${ratioUnit}時間`], 0, company, "非言語"
    ),
  ];
}

export function createSpiCards(company: string, index: number): SpiCompanyCard[] {
  return Array.from({ length: 10 }, (_, round) => createSpiCardSet(company, index, round))
    .flat()
    .map((card, cardIndex) => {
      const difficulty = cardIndex < 30 ? "★☆☆" : cardIndex < 70 ? "★★☆" : "★★★";
      const field = card.tags.includes("言語") ? "言語" : "非言語";
      return {
        ...card,
        front: card.front.replace(
          /^【[^】]+】/,
          `【${company}｜${field}｜${difficulty}｜第${cardIndex + 1}問】`,
        ),
        tags: [...card.tags, difficulty, `第${cardIndex + 1}問`],
      };
    });
}
