export const OFFICIAL_TOEIC_800_ID = "toeic-800-business-core";

type Vocabulary = readonly [word: string, meaning: string, note: string];

// Original study material for workplace and daily-life English. It does not copy
// TOEIC questions or the contents/ordering of any commercial vocabulary book.
const vocabulary: Vocabulary[] = [
  ["allocate", "割り当てる", "allocate funds / resources"], ["amend", "修正する", "amend a contract"], ["anticipate", "予想する", "anticipate demand"], ["approve", "承認する", "approve a proposal"], ["assess", "評価する", "assess the risk"],
  ["attain", "達成する", "attain a goal"], ["authorize", "許可する", "authorize payment"], ["boost", "高める", "boost sales"], ["clarify", "明確にする", "clarify the details"], ["collaborate", "協力する", "collaborate with a team"],
  ["compensate", "補償する", "compensate for a delay"], ["comply", "従う", "comply with regulations"], ["conduct", "実施する", "conduct a survey"], ["consolidate", "統合する", "consolidate data"], ["consult", "相談する", "consult a specialist"],
  ["coordinate", "調整する", "coordinate a project"], ["defer", "延期する", "defer a decision"], ["delegate", "委任する", "delegate a task"], ["determine", "決定する", "determine the cause"], ["disclose", "開示する", "disclose information"],
  ["distribute", "配布する", "distribute materials"], ["eliminate", "取り除く", "eliminate errors"], ["enforce", "施行する", "enforce a policy"], ["enhance", "高める", "enhance efficiency"], ["ensure", "確実にする", "ensure quality"],
  ["estimate", "見積もる", "estimate the cost"], ["exceed", "上回る", "exceed expectations"], ["facilitate", "容易にする", "facilitate communication"], ["finalize", "最終決定する", "finalize the schedule"], ["forecast", "予測する", "forecast revenue"],
  ["implement", "実行する", "implement a plan"], ["incur", "負う", "incur expenses"], ["indicate", "示す", "indicate a change"], ["inspect", "検査する", "inspect equipment"], ["maintain", "維持する", "maintain records"],
  ["negotiate", "交渉する", "negotiate terms"], ["notify", "通知する", "notify customers"], ["obtain", "得る", "obtain approval"], ["oversee", "監督する", "oversee operations"], ["participate", "参加する", "participate in training"],
  ["postpone", "延期する", "postpone a meeting"], ["procure", "調達する", "procure supplies"], ["reimburse", "払い戻す", "reimburse an employee"], ["retain", "保持する", "retain customers"], ["revise", "改訂する", "revise a report"],
  ["schedule", "予定を組む", "schedule an appointment"], ["streamline", "効率化する", "streamline a process"], ["submit", "提出する", "submit an application"], ["supervise", "監督する", "supervise staff"], ["terminate", "終了する", "terminate an agreement"],
  ["verify", "確認する", "verify an identity"], ["withdraw", "取り下げる", "withdraw an offer"], ["acquisition", "買収・取得", "an acquisition strategy"], ["agenda", "議題", "the meeting agenda"], ["amendment", "修正・改正", "an amendment to the contract"],
  ["applicant", "応募者", "a qualified applicant"], ["asset", "資産", "company assets"], ["budget", "予算", "stay within budget"], ["capacity", "能力・収容力", "production capacity"], ["compensation", "報酬・補償", "compensation package"],
  ["compliance", "法令順守", "regulatory compliance"], ["consignment", "委託貨物", "a consignment note"], ["constraint", "制約", "budget constraints"], ["credential", "資格証明", "professional credentials"], ["deduction", "控除", "a tax deduction"],
  ["deficit", "不足・赤字", "a budget deficit"], ["demand", "需要", "customer demand"], ["discrepancy", "食い違い", "a billing discrepancy"], ["dividend", "配当", "annual dividend"], ["endorsement", "承認・推薦", "written endorsement"],
  ["expenditure", "支出", "capital expenditure"], ["fixture", "備品・固定設備", "office fixtures"], ["incentive", "奨励金・動機", "a sales incentive"], ["inventory", "在庫", "inventory levels"], ["liability", "責任・負債", "legal liability"],
  ["merger", "合併", "a corporate merger"], ["mortgage", "住宅ローン・抵当", "mortgage payment"], ["outlet", "販売店・出口", "a retail outlet"], ["premises", "建物・敷地", "company premises"], ["procurement", "調達", "procurement process"],
  ["quota", "割当量・ノルマ", "meet a quota"], ["revenue", "収益", "annual revenue"], ["shipment", "出荷品", "track a shipment"], ["specification", "仕様", "product specifications"], ["stakeholder", "利害関係者", "key stakeholders"],
  ["subsidy", "補助金", "government subsidy"], ["surplus", "余剰・黒字", "a budget surplus"], ["tenant", "賃借人", "a prospective tenant"], ["venue", "開催場所", "conference venue"], ["warranty", "保証", "under warranty"],
  ["adjacent", "隣接した", "an adjacent building"], ["adverse", "不利な", "adverse weather"], ["annual", "年1回の", "annual report"], ["available", "利用可能な", "available upon request"], ["comprehensive", "包括的な", "comprehensive review"],
  ["confidential", "機密の", "confidential information"], ["consecutive", "連続した", "two consecutive days"], ["current", "現在の", "current policy"], ["eligible", "資格がある", "eligible for a refund"], ["equivalent", "同等の", "equivalent experience"],
  ["extensive", "広範囲の", "extensive experience"], ["flexible", "柔軟な", "flexible schedule"], ["mandatory", "義務的な", "mandatory training"], ["mutual", "相互の", "mutual agreement"], ["necessary", "必要な", "necessary documents"],
  ["pending", "保留中の", "pending approval"], ["preliminary", "予備の", "preliminary results"], ["prompt", "迅速な", "a prompt response"], ["prospective", "将来の・見込みの", "prospective client"], ["relevant", "関連する", "relevant experience"],
  ["sufficient", "十分な", "sufficient funds"], ["tentative", "仮の", "tentative schedule"], ["thorough", "徹底的な", "thorough inspection"], ["vacant", "空いている", "a vacant position"], ["valid", "有効な", "a valid receipt"],
];

export const officialToeicDeck = {
  id: OFFICIAL_TOEIC_800_ID,
  name: "TOEIC 800+｜ビジネス頻出語彙",
  description: "800点以上を目指す人向け。職場・日常場面で使う重要語を、意味と定番の組み合わせで覚えるオリジナル600枚以上のカード。",
  category: "英語・資格",
  cardCount: vocabulary.length * 6,
  cards: vocabulary.flatMap(([word, meaning, note]) => [
    { front: word, back: `${meaning}\n\nよく使う形：${note}` },
    { front: `${word} の意味は？`, back: `${meaning}\n\nよく使う形：${note}` },
    { front: `「${meaning}」に当たる英単語は？`, back: `${word}\n\nよく使う形：${note}` },
    { front: `${note} の中心語は？`, back: `${word}（${meaning}）` },
    { front: `${word} を使う定番表現は？`, back: note },
    { front: `${word}｜品詞・意味を即答`, back: `主に動詞・名詞・形容詞として使う重要語。意味：${meaning}\n\n${note}` },
  ]),
};
