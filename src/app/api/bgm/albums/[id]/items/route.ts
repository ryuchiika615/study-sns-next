import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from("bgm_album_items")
    .select("id, album_id, bgm_id, source_type, name, audio_url, youtube_url, local_key, position, created_at")
    .eq("album_id", id)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify album ownership
  const { data: album } = await supabase
    .from("bgm_albums")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

  const { bgm_id, source_type, name, audio_url, youtube_url, local_key } = await request.json();
  if (!source_type || !name?.trim()) return NextResponse.json({ error: "source_type and name required" }, { status: 400 });

  // Get next position
  const { data: lastItem } = await supabase
    .from("bgm_album_items")
    .select("position")
    .eq("album_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastItem?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("bgm_album_items")
    .insert({
      album_id: id,
      bgm_id: bgm_id || null,
      source_type,
      name: name.trim().slice(0, 100),
      audio_url: audio_url || "",
      youtube_url: youtube_url || null,
      local_key: local_key || null,
      position,
    })
    .select("id, album_id, bgm_id, source_type, name, audio_url, youtube_url, local_key, position, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify album ownership
  const { data: album } = await supabase
    .from("bgm_albums")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });

  const { items } = await request.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "items array required" }, { status: 400 });

  // Reorder: update positions
  for (let i = 0; i < items.length; i++) {
    const { error } = await supabase
      .from("bgm_album_items")
      .update({ position: i })
      .eq("id", items[i].id)
      .eq("album_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
