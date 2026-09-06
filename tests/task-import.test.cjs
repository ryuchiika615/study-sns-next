const assert = require("node:assert/strict");
const test = require("node:test");
require("typescript");

function localParse(input) {
  const seen = new Set(); const tasks = []; let skipped = 0;
  for (const raw of input.split(/\r?\n/)) {
    const columns = (raw.includes("\t") ? raw.split("\t") : raw.split(","));
    const title = (columns[0] || "").trim(); const rawDate = (columns[1] || "").trim().replace(/[./]/g, "-");
    const m = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); const date = m ? `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}` : "";
    if (!title || !date || title === "課題名") { if (title && title !== "課題名") skipped++; continue; }
    const key = title + date; if (seen.has(key)) { skipped++; continue; } seen.add(key); tasks.push({ title, due_date: date });
  } return { tasks, skipped };
}

test("tab separated tasks are normalized", () => assert.deepEqual(localParse("課題名\t締切日\nレポート\t2026/9/8").tasks, [{ title: "レポート", due_date: "2026-09-08" }]));
test("duplicates and invalid rows are skipped", () => assert.equal(localParse("A,2026-09-08\nA,2026-09-08\nB,なし").skipped, 2));
