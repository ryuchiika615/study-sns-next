"use client";

import { useState } from "react";

const CONNECTORS = ["", "の", "と", "や", "とか", "を", "が", "で", "に", "な", "も", "へ", "から", "より"];

function ConnectorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-gray-300 text-xs p-1.5 w-full text-center">
      {CONNECTORS.map((c) => (
        <option key={c} value={c}>{c || "−"}</option>
      ))}
    </select>
  );
}

export default function RefineParts({ parts, onRefine }: { parts: string[]; onRefine: (w: string, n: string, name: string, order: string, connA?: string, connB?: string) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [connA, setConnA] = useState("");
  const [connB, setConnB] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500">所持称号の文字を自由に選んで組み合わせられます。接続語でつなげることも可能</p>
      <div className="grid grid-cols-3 gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">パート1</option>
          {parts.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">パート2</option>
          {parts.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={c} onChange={(e) => setC(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">パート3</option>
          {parts.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 min-w-[3rem] text-center truncate">{a || "(1)"}</span>
        <ConnectorSelect value={connA} onChange={setConnA} />
        <span className="text-xs text-gray-500 min-w-[3rem] text-center truncate">{b || "(2)"}</span>
        <ConnectorSelect value={connB} onChange={setConnB} />
        <span className="text-xs text-gray-500 min-w-[3rem] text-center truncate">{c || "(3)"}</span>
      </div>
      <button onClick={() => onRefine(a, b, c, "word_first", connA, connB)}
        disabled={!a && !b && !c}
        className="w-full bg-gray-800 text-white rounded-full py-2 text-xs disabled:opacity-40">
        精錬する
      </button>
    </div>
  );
}
