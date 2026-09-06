export type ImportedTask = { title: string; due_date: string };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string) {
  const normalized = value.trim().replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  if (!datePattern.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "" : date;
}

export function parseTaskImport(input: string): { tasks: ImportedTask[]; skipped: number } {
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const columns = line.includes("\t") ? line.split("\t") : line.split(",");
    const title = (columns[0] || "").trim();
    const dueDate = normalizeDate(columns[1] || "");
    if (/^(課題名|タスク名|title)$/i.test(title) || !title || !dueDate || title.length > 120) {
      if (!/^(課題名|タスク名|title)$/i.test(title)) skipped += 1;
      continue;
    }
    const key = `${title}\u0000${dueDate}`;
    if (seen.has(key)) { skipped += 1; continue; }
    seen.add(key);
    tasks.push({ title, due_date: dueDate });
  }
  return { tasks: tasks.slice(0, 100), skipped: skipped + Math.max(0, tasks.length - 100) };
}
