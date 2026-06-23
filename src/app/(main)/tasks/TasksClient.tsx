"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Chart } from "@/lib/chart-registry";

type Habit = { id: string; name: string; sort_order: number };
type HabitLog = { id: string; habit_id: string; date: string; achieved: boolean };
type Textbook = { id: string; title: string; total_pages: number; pages_completed: number; target_end_date: string | null };
type CalendarDay = { date: string; minutes: number };
type TextbookLog = { date: string; pages_completed: number };

const DEFAULT_HABITS = ["8時間睡眠", "運動", "読書", "スマホ制限", "禁酒"];

const sectionCard = (title: string, icon: string, children: React.ReactNode) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
      <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
      <h2 className="text-sm font-bold">{title}</h2>
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </div>
);

function TrendChart({ logs, habits }: { logs: HabitLog[]; habits: Habit[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const total = habits.length || 1;

  const days: { date: string; rate: number }[] = [];
  const grouped = new Map<string, HabitLog[]>();
  for (const l of logs) {
    if (!grouped.has(l.date)) grouped.set(l.date, []);
    grouped.get(l.date)!.push(l);
  }
  const sorted = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  const labels: string[] = [];
  const data: number[] = [];
  for (const [date, dayLogs] of sorted) {
    const achieved = dayLogs.filter(l => l.achieved).length;
    labels.push(date.slice(5));
    data.push(Math.round((achieved / total) * 100));
  }

  useEffect(() => {
    if (!canvasRef.current || labels.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "達成率",
          data,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: "#22c55e",
        }],
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } } },
        plugins: { legend: { display: false } },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [logs, habits]);

  if (labels.length === 0) return <p className="text-gray-400 text-sm text-center py-4">データがありません</p>;
  return <canvas ref={canvasRef} height={200} />;
}

function HabitCalendar({ logs, habits, year, month }: { logs: HabitLog[]; habits: Habit[]; year: number; month: number }) {
  const total = habits.length || 1;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const logMap = new Map<string, HabitLog[]>();
  for (const l of logs) {
    if (!logMap.has(l.date)) logMap.set(l.date, []);
    logMap.get(l.date)!.push(l);
  }

  const cells: ({ day: number; rate: number; key: string } | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayLogs = logMap.get(key) || [];
    const achieved = dayLogs.filter(l => l.achieved).length;
    const rate = total > 0 ? Math.round((achieved / total) * 100) : 0;
    cells.push({ day: d, rate, key });
  }

  const color = (rate: number) => {
    if (rate === 100) return "bg-green-500 text-white";
    if (rate >= 80) return "bg-green-300 text-green-900";
    if (rate >= 50) return "bg-yellow-300 text-yellow-900";
    if (rate > 0) return "bg-red-300 text-red-900";
    return "bg-gray-100 text-gray-400";
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-500 mb-1">
        {["日", "月", "火", "水", "木", "金", "土"].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {cell ? (
              <div className={`w-full h-full rounded-md flex items-center justify-center text-[11px] font-bold ${color(cell.rate)} ${cell.key === today ? "ring-2 ring-primary" : ""}`}>
                {cell.day}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
        <span>0%</span>
        <div className="w-3 h-3 rounded bg-gray-100" />
        <div className="w-3 h-3 rounded bg-red-300" />
        <div className="w-3 h-3 rounded bg-yellow-300" />
        <div className="w-3 h-3 rounded bg-green-300" />
        <div className="w-3 h-3 rounded bg-green-500" />
        <span>100%</span>
      </div>
    </div>
  );
}

export default function TasksClient({
  userId, initialHabits, initialLogs, initialTextbooks, textbookLogs, calendarData,
}: {
  userId: string; initialHabits: Habit[]; initialLogs: HabitLog[]; initialTextbooks: Textbook[];
  textbookLogs: TextbookLog[]; calendarData: CalendarDay[];
}) {
  const supabase = createClient();
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [logs, setLogs] = useState<HabitLog[]>(initialLogs);
  const [textbooks, setTextbooks] = useState<Textbook[]>(initialTextbooks);
  const [newHabitName, setNewHabitName] = useState("");
  const [message, setMessage] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showTextbookForm, setShowTextbookForm] = useState(false);
  const [editTextbookId, setEditTextbookId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPages, setFormPages] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [progressTextbookId, setProgressTextbookId] = useState<string | null>(null);
  const [progressPages, setProgressPages] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const addToast = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 3000); };

  const seedHabits = useCallback(async () => {
    const existing = habits.map(h => h.name);
    const toAdd = DEFAULT_HABITS.filter(n => !existing.includes(n));
    if (toAdd.length === 0) return;
    const maxOrder = habits.reduce((m, h) => Math.max(m, h.sort_order), 0);
    const inserts = toAdd.map((name, i) => ({ user_id: userId, name, sort_order: maxOrder + i + 1 }));
    const { data } = await supabase.from("habits").insert(inserts).select();
    if (data) setHabits(prev => [...prev, ...data]);
  }, [habits, userId]);

  useEffect(() => { if (habits.length === 0) seedHabits(); }, []);

  const toggleHabit = async (habitId: string) => {
    const existing = logs.find(l => l.habit_id === habitId && l.date === today);
    if (existing) {
      const next = !existing.achieved;
      setLogs(prev => prev.map(l => l.id === existing.id ? { ...l, achieved: next } : l));
      await supabase.from("habit_logs").update({ achieved: next }).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("habit_logs").insert({
        user_id: userId, habit_id: habitId, date: today, achieved: true,
      }).select().single();
      if (data) setLogs(prev => [...prev, data]);
    }
  };

  const addHabit = async () => {
    if (!newHabitName.trim()) return;
    const maxOrder = habits.reduce((m, h) => Math.max(m, h.sort_order), 0);
    const { data, error } = await supabase.from("habits").insert({
      user_id: userId, name: newHabitName.trim(), sort_order: maxOrder + 1,
    }).select().single();
    if (error) { addToast(error.message); return; }
    setHabits(prev => [...prev, data]);
    setNewHabitName("");
    addToast("習慣を追加しました");
  };

  const deleteHabit = async (id: string) => {
    if (!confirm("削除しますか？\n関連するログも削除されます。")) return;
    await supabase.from("habit_logs").delete().eq("habit_id", id);
    await supabase.from("habits").delete().eq("id", id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setLogs(prev => prev.filter(l => l.habit_id !== id));
    addToast("削除しました");
  };

  const startEditHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditingHabitName(habit.name);
  };

  const saveEditHabit = async (id: string) => {
    if (!editingHabitName.trim()) return;
    await supabase.from("habits").update({ name: editingHabitName.trim() }).eq("id", id);
    setHabits(prev => prev.map(h => h.id === id ? { ...h, name: editingHabitName.trim() } : h));
    setEditingHabitId(null);
    addToast("編集しました");
  };

  const dayLogs = (date: string) => {
    return habits.map(h => ({
      habit: h,
      log: logs.find(l => l.habit_id === h.id && l.date === date),
    }));
  };

  const achievementRate = (date: string) => {
    if (habits.length === 0) return 0;
    const dl = logs.filter(l => l.date === date && l.achieved);
    return Math.round((dl.length / habits.length) * 100);
  };

  const dates = [...new Set(logs.map(l => l.date))].sort((a, b) => b.localeCompare(a));

  const handleAddOrEditTextbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPages) return;
    const total = parseInt(formPages) || 0;
    if (total <= 0) return;
    if (editTextbookId) {
      const { error } = await supabase.from("textbooks").update({ title: formTitle.trim(), total_pages: total, target_end_date: formTarget || null }).eq("id", editTextbookId);
      if (error) { addToast(error.message); return; }
      setTextbooks(prev => prev.map(t => t.id === editTextbookId ? { ...t, title: formTitle.trim(), total_pages: total, target_end_date: formTarget || null } : t));
      addToast("更新しました");
    } else {
      const { data, error } = await supabase.from("textbooks").insert({ user_id: userId, title: formTitle.trim(), total_pages: total, pages_completed: 0, target_end_date: formTarget || null }).select().single();
      if (error) { addToast(error.message); return; }
      setTextbooks(prev => [data, ...prev]);
      addToast("追加しました");
    }
    setShowTextbookForm(false);
    setEditTextbookId(null);
    setFormTitle("");
    setFormPages("");
    setFormTarget("");
  };

  const handleDeleteTextbook = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from("textbook_progress_logs").delete().eq("textbook_id", id);
    await supabase.from("textbooks").delete().eq("id", id);
    setTextbooks(prev => prev.filter(t => t.id !== id));
    addToast("削除しました");
  };

  const handleTextbookProgress = async (textbook: Textbook) => {
    const pages = parseInt(progressPages);
    if (!pages || pages <= 0) return;
    const newCompleted = Math.min(textbook.pages_completed + pages, textbook.total_pages);
    await supabase.from("textbooks").update({ pages_completed: newCompleted }).eq("id", textbook.id);
    await supabase.from("textbook_progress_logs").insert({ textbook_id: textbook.id, user_id: userId, pages_completed: pages, date: today });
    setTextbooks(prev => prev.map(t => t.id === textbook.id ? { ...t, pages_completed: newCompleted } : t));
    setProgressTextbookId(null);
    setProgressPages("");
    addToast("進捗を記録しました");
  };

  const openEditTextbook = (t: Textbook) => {
    setFormTitle(t.title);
    setFormPages(String(t.total_pages));
    setFormTarget(t.target_end_date || "");
    setEditTextbookId(t.id);
    setShowTextbookForm(true);
  };

  const openAddTextbook = () => {
    setFormTitle("");
    setFormPages("");
    setFormTarget("");
    setEditTextbookId(null);
    setShowTextbookForm(true);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-bold flex items-center gap-2">
        <i className="fas fa-tasks text-primary" /> リュッターのタスク
      </h1>

      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm cursor-pointer" onClick={() => setMessage("")}>
          {message}
        </div>
      )}

      {sectionCard("今日の習慣", "fa-check-circle",
        <>
          <div className="space-y-1">
            {habits.map(h => {
              const dl = logs.find(l => l.habit_id === h.id && l.date === today);
              const done = dl?.achieved ?? false;
              return (
                <button key={h.id} onClick={() => toggleHabit(h.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition text-left ${
                    done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200 hover:border-primary/30"
                  }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sm ${
                    done ? "bg-green-500 text-white" : "bg-white border-2 border-gray-300"
                  }`}>
                    {done && <i className="fas fa-check" />}
                  </div>
                  <span className={`text-sm font-medium ${done ? "text-green-700 line-through" : "text-gray-700"}`}>
                    {h.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">今日の達成率</p>
            <p className="text-2xl font-bold text-primary">{achievementRate(today)}%</p>
            <p className="text-xs text-gray-400">{logs.filter(l => l.date === today && l.achieved).length}/{habits.length}項目</p>
          </div>
        </>
      )}

      {sectionCard("習慣の管理", "fa-gear",
        <>
          <div className="flex gap-2">
            <input type="text" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="新しい習慣"
              className="flex-1 rounded-lg border-gray-300 text-sm py-1.5"
              onKeyDown={(e) => e.key === "Enter" && addHabit()} />
            <button onClick={addHabit}
              className="bg-primary text-white rounded-full px-4 text-sm font-bold border-none cursor-pointer shrink-0">
              追加
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {habits.map((h, i) => (
              <div key={h.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                {editingHabitId === h.id ? (
                  <div className="flex gap-1 items-center w-full">
                    <input type="text" value={editingHabitName} onChange={(e) => setEditingHabitName(e.target.value)}
                      className="flex-1 rounded-lg border-gray-300 text-sm py-0.5 px-1.5" autoFocus
                      onKeyDown={(e) => e.key === "Enter" && saveEditHabit(h.id)} />
                    <button onClick={() => saveEditHabit(h.id)}
                      className="text-xs px-2 py-0.5 bg-primary text-white rounded-full border-none cursor-pointer">保存</button>
                    <button onClick={() => setEditingHabitId(null)}
                      className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full border-none cursor-pointer">取消</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-300 text-xs w-4">{i + 1}.</span>
                      <span>{h.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEditHabit(h)}
                        className="text-xs text-gray-400 hover:text-blue-500 bg-none border-none cursor-pointer">
                        <i className="fas fa-pen" />
                      </button>
                      <button onClick={() => deleteHabit(h.id)}
                        className="text-xs text-red-400 hover:text-red-600 bg-none border-none cursor-pointer">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {sectionCard("達成率の推移", "fa-chart-line",
        <TrendChart logs={logs} habits={habits} />
      )}

      {sectionCard("カレンダー", "fa-calendar-alt",
        <>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
              className="text-gray-400 hover:text-gray-600 bg-none border-none cursor-pointer text-sm">
              <i className="fas fa-chevron-left" />
            </button>
            <span className="text-sm font-bold">{calYear}年{calMonth + 1}月</span>
            <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
              className="text-gray-400 hover:text-gray-600 bg-none border-none cursor-pointer text-sm">
              <i className="fas fa-chevron-right" />
            </button>
          </div>
          <HabitCalendar logs={logs} habits={habits} year={calYear} month={calMonth} />
        </>
      )}

      {dates.length > 0 && sectionCard("習慣ログ一覧", "fa-list",
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-1 sticky left-0 bg-white whitespace-nowrap">日付</th>
                {habits.map(h => <th key={h.id} className="py-2 px-1 text-center whitespace-nowrap">{h.name}</th>)}
                <th className="py-2 px-1 text-center whitespace-nowrap">達成率</th>
              </tr>
            </thead>
            <tbody>
              {dates.slice(0, 31).map(date => (
                <tr key={date} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-1 sticky left-0 bg-white text-gray-500 whitespace-nowrap">{date}</td>
                  {habits.map(h => {
                    const l = logs.find(li => li.habit_id === h.id && li.date === date);
                    return (
                      <td key={h.id} className="py-2 px-1 text-center">
                        {l?.achieved ? <span className="text-green-500">✅</span> : <span className="text-gray-300">❌</span>}
                      </td>
                    );
                  })}
                  <td className="py-2 px-1 text-center font-bold">{achievementRate(date)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sectionCard("テキスト管理", "fa-book",
        <>
          {textbooks.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">テキストが登録されていません</p>
          )}
          {textbooks.map(t => {
            const pct = t.total_pages > 0 ? Math.round((t.pages_completed / t.total_pages) * 100) : 0;
            return (
              <div key={t.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm truncate">{t.title}</span>
                  <span className={`text-xs font-bold shrink-0 ${pct >= 100 ? "text-green-500" : "text-primary"}`}>{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t.pages_completed}/{t.total_pages}ページ</span>
                  {t.target_end_date && <span>目標: {t.target_end_date}</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setProgressTextbookId(progressTextbookId === t.id ? null : t.id); setProgressPages(""); }}
                    className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full border-none cursor-pointer hover:bg-primary/20">
                    <i className="fas fa-plus mr-1" />進捗追加
                  </button>
                  <button onClick={() => openEditTextbook(t)}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full border-none cursor-pointer hover:bg-gray-200">
                    <i className="fas fa-pen mr-1" />編集
                  </button>
                  <button onClick={() => handleDeleteTextbook(t.id)}
                    className="text-xs px-3 py-1 bg-red-50 text-red-500 rounded-full border-none cursor-pointer hover:bg-red-100">
                    <i className="fas fa-trash mr-1" />
                  </button>
                </div>
                {progressTextbookId === t.id && (
                  <form onSubmit={(e) => { e.preventDefault(); handleTextbookProgress(t); }}
                    className="flex gap-2 items-center pt-1 border-t border-gray-100 mt-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">今日 +</span>
                    <input type="number" value={progressPages} onChange={(e) => setProgressPages(e.target.value)}
                      min={1} max={t.total_pages - t.pages_completed} placeholder="ページ数"
                      className="w-20 rounded-lg border-gray-300 text-sm py-1" autoFocus />
                    <span className="text-xs text-gray-500">ページ</span>
                    <button type="submit"
                      className="text-xs px-3 py-1 bg-primary text-white rounded-full border-none cursor-pointer">
                      記録
                    </button>
                  </form>
                )}
              </div>
            );
          })}
          <button onClick={openAddTextbook}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-primary hover:text-primary transition bg-transparent">
            <i className="fas fa-plus mr-1" /> 新しいテキストを追加
          </button>
        </>
      )}

      {showTextbookForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowTextbookForm(false); setEditTextbookId(null); }}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm mb-4">{editTextbookId ? "テキストを編集" : "新しいテキストを追加"}</h3>
            <form onSubmit={handleAddOrEditTextbook} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">テキスト名</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" placeholder="数学IA" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">総ページ数</label>
                <input type="number" value={formPages} onChange={(e) => setFormPages(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" min={1} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">目標完了日（任意）</label>
                <input type="date" value={formTarget} onChange={(e) => setFormTarget(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit"
                  className="flex-1 bg-primary text-white font-bold rounded-full py-1.5 text-sm cursor-pointer">
                  {editTextbookId ? "保存" : "追加"}
                </button>
                <button type="button" onClick={() => { setShowTextbookForm(false); setEditTextbookId(null); }}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-full py-1.5 text-sm cursor-pointer">
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
