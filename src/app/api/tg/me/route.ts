import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fullName, isStaff, telegramUserFrom } from "@/lib/telegram-webapp";

// Who opened the Mini App, and the requests they sent before. Only the
// requests tied to the verified Telegram id are returned.
export async function GET(req: Request) {
  const user = telegramUserFrom(req);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("id, created_at, status, project_type")
    .eq("telegram_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("[tg] load failed:", error.message);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, name: fullName(user), firstName: user.first_name, staff: isStaff(user), requests: data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
