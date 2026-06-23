"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

type Textbook = {
  id: string;
  title: string;
  total_pages: number;
  pages_completed: number;
  target_end_date: string | null;
  created_at: string;
};

type CalendarDay = { date: string; minutes: number };

type TasksClientProps = {
  userId: string;
  initialTextbooks: Textbook[];
  calendarData: CalendarDay[];
  textbookLogs: { date: string; pages_completed: number }[];
  consecutiveDays: number;
};

function TextbookCalendar({ data, textbookLogs }: { data: CalendarDay[]; textbookLogs: { date: string; pages_completed: number }[] }) {
  const year = new Date().getFullYear();
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const startDay = startDate.getDay();

  const studyMap = new Map<string, number>();
  for (const d of data) studyMap.set(d.date, (studyMap.get(d.date) || 0) + d.minutes);

  const logMap = new Map<string, number>();
  for (const l of textbookLogs) logMap.set(l.date, (logMap.get(l.date) || 0) + l.pages_completed);

  const days: { date: string; level: number; hasTextbook: boolean }[] = [];
  const d = new Date(startDate);
  d.setDate(d.getDate() - startDay);
  while (d <= endDate) {
    const key = d.toISOString().split("T")[0];
    const mins = studyMap.get(key) || 0;
    let level = 0;
    if (mins > 0) level = mins <= 30 ? 1 : mins <= 60 ? 2 : mins <= 120 ? 3 : 4;
    days.push({ date: key, level, hasTextbook: (logMap.get(key) || 0) > 0 });
    d.setDate(d.getDate() + 1);
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const colors = ["bg-gray-100", "bg-blue-200", "bg-blue-400", "bg-blue-600", "bg-blue-800"];

  return (
    <div>
      <div className="flex gap-[2px] overflow-x-auto pb-2 w-full">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px] shrink-0">
            {week.map((day, di) => (
              <div key={day.date} className="relative">
                <div className={`w-3.5 h-3.5 rounded-[3px] ${colors[day.level]}`}
                  title={`${day.date}: ${studyMap.get(day.date) || 0}分 ${logMap.get(day.date) ? `+${logMap.get(day.date)}ページ` : ""}`} />
                {day.hasTextbook && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500 border border-white" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
        <span>少</span>
        {colors.map((c, i) => <div key={i} className={`w-3.5 h-3.5 rounded-[3px] ${c}`} />)}
        <span>多</span>
        <span className="ml-3 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> テキスト</span>
      </div>
    </div>
  );
}

const sectionCard = (title: string, icon: string, children: React.ReactNode) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
      <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
      <h2 className="text-sm font-bold">{title}</h2>
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </div>
);

export default function TasksClient({ userId, initialTextbooks, calendarData, textbookLogs: initialLogs, consecutiveDays }: TasksClientProps) {
  const supabase = createClient();
  const [textbooks, setTextbooks] = useState<Textbook[]>(initialTextbooks);
  const [logs, setLogs] = useState<{ date: string; pages_completed: number }[]>(initialLogs);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPages, setFormPages] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [progressPages, setProgressPages] = useState("");
  const [message, setMessage] = useState("");
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [monthStudyDays, setMonthStudyDays] = useState(0);
  const [todayDone, setTodayDone] = useState(false);
  const calendarDataRef = useRef(calendarData);

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  useEffect(() => {
    const studyToday = calendarDataRef.current
      .filter(d => d.date === today)
      .reduce((sum, d) => sum + d.minutes, 0);
    setTodayMinutes(studyToday);
    setTodayDone(studyToday > 0);

    const monthDays = new Set(
      calendarDataRef.current
        .filter(d => d.date >= monthStart && d.date <= today)
        .map(d => d.date)
    );
    setMonthStudyDays(monthDays.size);

    const fetchToday = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;
      const todayStart = `${today}T00:00:00Z`;
      const todayEnd = `${today}T23:59:59Z`;
      const { data: todayPosts } = await supabase
        .from("posts")
        .select("study_minutes")
        .eq("user_id", userId)
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      const mins = (todayPosts || []).reduce((s, p: any) => s + (p.study_minutes || 0), 0);
      setTodayMinutes(mins);
      setTodayDone(mins > 0);
    };
    fetchToday();
  }, []);
const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPages) return;
    const total = parseInt(formPages) || 0;
    if (total <= 0) return;

    if (editId) {
      const { error } = await supabase
        .from("textbooks")
        .update({ title: formTitle.trim(), total_pages: total, target_end_date: formTarget || null })
        .eq("id", editId);
      if (error) { setMessage(error.message); return; }
      setTextbooks(prev => prev.map(t => t.id === editId ? { ...t, title: formTitle.trim(), total_pages: total, target_end_date: formTarget || null } : t));
      setMessage("更新しました");
    } else {
      const { data, error } = await supabase
        .from("textbooks")
        .insert({ user_id: userId, title: formTitle.trim(), total_pages: total, pages_completed: 0, target_end_date: formTarget || null })
        .select()
        .single();
      if (error) { setMessage(error.message); return; }
      setTextbooks(prev => [data, ...prev]);
      setMessage("追加しました");
    }
    setShowForm(false);
    setEditId(null);
    setFormTitle("");
    setFormPages("");
    setFormTarget("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const { error } = await supabase.from("textbooks").delete().eq("id", id);
    if (error) { setMessage(error.message); return; }
    setTextbooks(prev => prev.filter(t => t.id !== id));
    setMessage("削除しました");
  };

  const handleProgress = async (textbook: Textbook) => {
    const pages = parseInt(progressPages);
    if (!pages || pages <= 0) return;
    const newCompleted = Math.min(textbook.pages_completed + pages, textbook.total_pages);

    const { error } = await supabase
      .from("textbooks")
      .update({ pages_completed: newCompleted })
      .eq("id", textbook.id);
    if (error) { setMessage(error.message); return; }

    await supabase
      .from("textbook_progress_logs")
      .insert({ textbook_id: textbook.id, user_id: userId, pages_completed: pages, date: today });

    setTextbooks(prev => prev.map(t => t.id === textbook.id ? { ...t, pages_completed: newCompleted } : t));
    setLogs(prev => [...prev, { date: today, pages_completed: pages }]);
    setProgressId(null);
    setProgressPages("");
    setMessage("進捗を記録しました");
  };

  const openEdit = (t: Textbook) => {
    setFormTitle(t.title);
    setFormPages(String(t.total_pages));
    setFormTarget(t.target_end_date || "");
    setEditId(t.id);
    setShowForm(true);
  };

  const openAdd = () => {
    setFormTitle("");
    setFormPages("");
    setFormTarget("");
    setEditId(null);
    setShowForm(true);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-bold flex items-center gap-2">
        <i className="fas fa-tasks text-primary" /> タスク管理
      </h1>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes("失敗") || message.includes("error") ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}
          onClick={() => setMessage("")}>{message}</div>
      )}

      {sectionCard("習慣トラッカー", "fa-check-circle",
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className={`text-lg font-bold ${todayDone ? "text-green-500" : "text-gray-400"}`}>
                {todayDone ? "✅" : "⏳"}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">今日の勉強</p>
              <p className="text-xs font-bold">{todayMinutes}分</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-lg font-bold text-orange-500">🔥{consecutiveDays}</p>
              <p className="text-[10px] text-gray-500 mt-1">連続勉強</p>
              <p className="text-xs font-bold">{consecutiveDays}日</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-lg font-bold text-blue-500">{monthStudyDays}/{daysInMonth}</p>
              <p className="text-[10px] text-gray-500 mt-1">今月の勉強</p>
              <p className="text-xs font-bold">{monthStudyDays}日</p>
            </div>
          </div>
        </>
      )}

      {sectionCard("勉強カレンダー", "fa-calendar-alt",
        <TextbookCalendar data={calendarData} textbookLogs={logs} />
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
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="fas fa-book text-primary shrink-0" />
                    <span className="font-bold text-sm truncate">{t.title}</span>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${pct >= 100 ? "text-green-500" : "text-primary"}`}>
                    {pct}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{t.pages_completed}/{t.total_pages}ページ</span>
                  {t.target_end_date && <span>目標: {t.target_end_date}</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setProgressId(progressId === t.id ? null : t.id); setProgressPages(""); }}
                    className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full border-none cursor-pointer hover:bg-primary/20">
                    <i className="fas fa-plus mr-1" />進捗追加
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full border-none cursor-pointer hover:bg-gray-200">
                    <i className="fas fa-pen mr-1" />編集
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="text-xs px-3 py-1 bg-red-50 text-red-500 rounded-full border-none cursor-pointer hover:bg-red-100">
                    <i className="fas fa-trash mr-1" />
                  </button>
                </div>
                {progressId === t.id && (
                  <form onSubmit={(e) => { e.preventDefault(); handleProgress(t); }}
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
          <button onClick={openAdd}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-primary hover:text-primary transition bg-transparent">
            <i className="fas fa-plus mr-1" /> 新しいテキストを追加
          </button>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditId(null); }}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm mb-4">{editId ? "テキストを編集" : "新しいテキストを追加"}</h3>
            <form onSubmit={handleAddOrEdit} className="space-y-3">
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
                  {editId ? "保存" : "追加"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
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
