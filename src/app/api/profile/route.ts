import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, current_title:current_title_id(*), current_avatar:current_avatar_id(*)")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const displayName = formData.get("display_name") as string;
  const bio = formData.get("bio") as string;
  const department = formData.get("department") as string;
  const themeColor = (formData.get("theme_color") as string) || "dark";
  const targetDate = (formData.get("target_date") as string) || null;
  const targetMinutes = parseInt((formData.get("target_minutes") as string) || "0");
  const iconFile = formData.get("icon") as File | null;

  let iconUrl: string | null = null;
  if (iconFile) {
    const fileExt = iconFile.name.split(".").pop();
    const fileName = `icons/${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, iconFile);

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      iconUrl = urlData?.publicUrl || null;
    }
  }

  const updateData: Record<string, any> = {
    display_name: displayName,
    bio,
    department,
    theme_color: themeColor,
    target_date: targetDate,
    target_minutes: targetMinutes,
  };

  if (iconUrl) updateData.icon_url = iconUrl;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}
