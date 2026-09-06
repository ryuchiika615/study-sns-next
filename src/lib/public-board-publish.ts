type RpcError = { code?: string; message?: string };
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

export async function publishPublicBoardPost(client: RpcClient, input: {
  category: string; content: string; groupId: string; imageUrl: string | null;
}) {
  const content = input.content.trim();
  if (!content || content.length > 2000) throw new Error("投稿内容を1〜2000文字で入力してください");
  const recruitment = input.category === "グループ募集";
  if (recruitment && !input.groupId) throw new Error("募集するグループを選んでください");
  // Do not fall back to create_post: a separate insert can leave an incomplete recruitment.
  const { error } = recruitment
    ? await client.rpc("create_group_recruitment_post", {
      p_group_id: input.groupId, p_content: content, p_image_url: input.imageUrl,
    })
    : await client.rpc("create_post", {
      p_content: content, p_subject: input.category, p_study_minutes: 0, p_workout_minutes: 0,
      p_image_url: input.imageUrl, p_image_urls: input.imageUrl ? [input.imageUrl] : null,
      p_study_date: null, p_quote_post_id: null, p_quote_comment_id: null,
      p_silent: false, p_audio_url: null, p_audio_name: null, p_pages_completed: 0, p_total_pages: 0,
    });
  if (error) {
    if (recruitment && (error.code === "PGRST202" || /could not find the function|schema cache/i.test(error.message || ""))) {
      throw new Error("グループ募集の準備が完了していません。管理者にデータベース更新（0123）の実行を依頼してください。入力内容はそのまま残しています。");
    }
    throw new Error(error.message || "投稿できませんでした");
  }
}
