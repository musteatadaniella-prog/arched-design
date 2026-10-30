import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { telegramStaffFrom } from "@/lib/telegram-webapp";

// The funnel for staff in the Mini App. Anyone not on TELEGRAM_STAFF_IDS gets 403.
export async function GET(req: Request) {
  const staff = telegramStaffFrom(req);
  if (!staff) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("id, created_at, status, source, name, phone, project_type")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[tg-crm] load failed:", error.message);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leads: data }, { headers: { "Cache-Control": "private, no-store" } });
}
