export function rescueRecordRequest(task: string, minutes: string, destination: string) {
  const duration = Number(minutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440 || !destination) {
    throw new Error("実際に勉強した時間（1〜1440分）と投稿先を選んでください。");
  }
  if (task.trim().length > 2000) throw new Error("本文は2000文字以内で入力してください。");
  const args = {
    p_content: task.trim() || "今日の課題に取り組みました。", p_subject: "その他", p_study_minutes: duration, p_silent: true,
    p_image_url: null, p_image_urls: null, p_study_date: null, p_quote_post_id: null, p_quote_comment_id: null,
    p_audio_url: null, p_audio_name: null, p_workout_minutes: 0, p_pages_completed: 0, p_total_pages: 0,
  };
  return destination === "public"
    ? { name: "create_post", args }
    : { name: "create_group_post", args: { ...args, p_group_id: destination } };
}
