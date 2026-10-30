import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isStatus } from "@/app/admin/statuses";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fullName, telegramStaffFrom } from "@/lib/telegram-webapp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const forbidden = () => NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
const notFound = () => NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

// One client card with its stage history.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!telegramStaffFrom(req)) return forbidden();
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const db = supabaseAdmin();
  const [{ data: lead, error }, { data: history }] = await Promise.all([
    db
      .from("leads")
      .select(
        "id, created_at, status, source, kind, name, phone, email, project_type, area, comment, notes, meeting_date, meeting_time, telegram_username",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("lead_stage_history")
      .select("id, from_status, to_status, changed_at, changed_by")
      .eq("lead_id", id)
      .order("changed_at", { ascending: true }),
  ]);
  if (error) {
    console.error("[tg-crm] card failed:", error.message);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }
  if (!lead) return notFound();

  return NextResponse.json({ ok: true, lead, history: history ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

// Moves the client to another stage. The history row records "Telegram: <name>".
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = telegramStaffFrom(req);
  if (!staff) return forbidden();
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (!isStatus(body?.status)) return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });

  const { data: found, error } = await supabaseAdmin().rpc("set_lead_stage", {
    p_id: id,
    p_status: body.status,
    p_actor: `Telegram: ${fullName(staff)}`,
  });
  if (error) {
    console.error("[tg-crm] stage failed:", error.message);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
  if (!found) return notFound();

  revalidatePath("/admin", "layout");
  return NextResponse.json({ ok: true });
}
