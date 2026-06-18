"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyQuestion, setSurveyQuestion] = useState("");
  const [surveyOptions, setSurveyOptions] = useState(["良い", "ダメ", "どちらでも"]);
  const [surveyAnonymous, setSurveyAnonymous] = useState(true);
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [viewResults, setViewResults] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!p?.is_admin) { setError("管理者のみアクセスできます"); return; }
      fetchAnnouncements();
      fetchSurveys();
    });
  }, []);

  const fetchAnnouncements = async () => {
    const res = await fetch("/api/admin/announcements");
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data.announcements);
    }
  };

  const fetchSurveys = async () => {
    const res = await fetch("/api/admin/surveys");
    if (res.ok) {
      const data = await res.json();
      setSurveys(data.surveys);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!content.trim()) return;
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        setMessage("お知らせを送信しました！");
        setContent("");
        fetchAnnouncements();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `送信失敗 (${res.status})`);
      }
    } catch (e: any) {
      setError(e.message || "ネットワークエラー");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("取り消しますか？（ユーザーから非表示になります）")) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchAnnouncements();
      else { const data = await res.json().catch(() => ({})); setError(data.error || `削除失敗 (${res.status})`); }
    } catch (e: any) { setError(e.message || "ネットワークエラー"); }
  };

  const handleCreateSurvey = async () => {
    if (!surveyQuestion.trim()) { setError("質問を入力してください"); return; }
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: surveyQuestion.trim(), options: surveyOptions.filter(Boolean), anonymous: surveyAnonymous }),
    });
    if (res.ok) {
      setMessage("アンケートを作成しました！");
      setSurveyQuestion("");
      setSurveyOptions(["良い", "ダメ", "どちらでも"]);
      setSurveyAnonymous(true);
      setShowSurveyForm(false);
      fetchSurveys();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "作成失敗");
    }
  };

  const handleCloseSurvey = async (surveyId: string) => {
    if (!confirm("このアンケートを締め切りますか？")) return;
    const res = await fetch("/api/admin/surveys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survey_id: surveyId }),
    });
    if (res.ok) {
      setMessage("アンケートを締め切りました");
      fetchSurveys();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "締め切り失敗");
    }
  };

  const viewSurvey = surveys.find((s) => s.id === viewResults);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0">お知らせ・アンケート管理</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{message}</div>}

        {/* お知らせ作成 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="font-bold">新規お知らせ</h2>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border-gray-300 text-sm" rows={4} placeholder="お知らせ内容" required />
          <button type="submit" className="bg-primary text-white font-bold rounded-full px-6 py-2 text-sm">
            送信
          </button>
        </form>

        {/* アンケート作成 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">アンケート</h2>
            <button onClick={() => setShowSurveyForm(!showSurveyForm)}
              className="text-xs text-primary cursor-pointer bg-none border-none">
              {showSurveyForm ? "閉じる" : "新規作成"}
            </button>
          </div>

          {showSurveyForm && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div>
                <label className="text-xs text-gray-500">質問</label>
                <input type="text" value={surveyQuestion} onChange={(e) => setSurveyQuestion(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm" placeholder="例: この機能どうしますか？" />
              </div>
              <div>
                <label className="text-xs text-gray-500">選択肢（改行区切り）</label>
                <textarea value={surveyOptions.join("\n")} onChange={(e) => setSurveyOptions(e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                  className="w-full rounded-lg border-gray-300 text-sm" rows={3} />
                <p className="text-[10px] text-gray-400 mt-0.5">「返信を入力」オプションが自動で追加されます</p>
              </div>
              <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                <span>匿名投票（誰が答えたか見えない）</span>
                <input type="checkbox" checked={surveyAnonymous} onChange={(e) => setSurveyAnonymous(e.target.checked)}
                  className="cursor-pointer" />
              </label>
              <button onClick={handleCreateSurvey}
                className="bg-purple-600 text-white font-bold rounded-full px-6 py-2 text-sm">
                アンケートを送信
              </button>
            </div>
          )}

          <div className="space-y-2">
            {surveys.length === 0 && <p className="text-xs text-gray-400">まだアンケートはありません</p>}
            {surveys.map((s: any) => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold">{s.question}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.anonymous ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600"}`}>
                        {s.anonymous ? "匿名" : "公開"}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {s.closed_at ? `締切: ${new Date(s.closed_at).toLocaleString("ja-JP")}` : "回答受付中"}
                      {" · "}{s.total_responses}件の回答
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setViewResults(viewResults === s.id ? null : s.id)}
                      className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 cursor-pointer whitespace-nowrap">
                      結果
                    </button>
                    {!s.closed_at && (
                      <button onClick={() => handleCloseSurvey(s.id)}
                        className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 cursor-pointer whitespace-nowrap">
                        締切
                      </button>
                    )}
                  </div>
                </div>

                {viewResults === s.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                    {s.options?.map((opt: string) => {
                      const count = s.counts?.[opt] || 0;
                      const pct = s.total_responses > 0 ? Math.round((count / s.total_responses) * 100) : 0;
                      return (
                        <div key={opt}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span>{opt}</span>
                            <span className="text-gray-500">{count}票 ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          {!s.anonymous && s.voters?.[opt]?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {s.voters[opt].map((v: any, i: number) => (
                                <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded">
                                  {v.display_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {s.responses?.filter((r: any) => r.custom_reply).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-bold text-gray-500 mb-1">返信:</p>
                        {s.responses.filter((r: any) => r.custom_reply).map((r: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded p-1.5 mb-1">
                            {!s.anonymous && r.users && <span className="font-medium">{r.users.display_name || r.users.username}: </span>}
                            「{r.selected_option}」 {r.custom_reply}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 送信済みお知らせ */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100 font-bold">送信済みお知らせ</div>
          {announcements.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">まだお知らせはありません</p>
          )}
          {announcements.map((a: any) => (
            <div key={a.id} className="p-4 border-b border-gray-100 last:border-0 flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleString("ja-JP")}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0 items-center">
                {a.is_deleted && <span className="text-xs text-gray-400">取消済</span>}
                {!a.is_deleted && (
                  <button onClick={() => handleDeleteAnnouncement(a.id)}
                    className="text-orange-500 text-xs cursor-pointer whitespace-nowrap">
                    取り消し
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
