import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;

  // Verify album ownership
  const { data: album } = await supabase
    .from("bgm_albums")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

  const { error } = await supabase
    .from("bgm_album_items")
    .delete()
    .eq("id", itemId)
    .eq("album_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
