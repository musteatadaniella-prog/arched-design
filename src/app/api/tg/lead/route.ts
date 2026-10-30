import { NextResponse, after } from "next/server";
import { dicts } from "@/content/dict";
import { validateLead } from "@/lib/lead";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { leadMessage, notifyTelegram } from "@/lib/telegram";
import { fullName, telegramUserFrom } from "@/lib/telegram-webapp";

// Every service offered in the catalog, in both languages.
const SERVICES = new Set(
  Object.values(dicts).flatMap((d) => d.services.items.flatMap((s) => s.list)),
);

// A request sent from the Telegram Mini App. The name comes from the verified
// Telegram data, never from the request body.
export async function POST(req: Request) {
  const user = telegramUserFrom(req);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const service = typeof body.service === "string" ? body.service : "";
  if (!SERVICES.has(service)) {
    return NextResponse.json({ ok: false, errors: { service: "required" } }, { status: 400 });
  }

  const { lead, errors } = validateLead({
    kind: "quote",
    name: fullName(user),
    phone: body.phone,
    area: body.area,
    comment: body.comment,
    projectType: service,
  });
  delete errors.name; // a Telegram first name can be one letter
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const lang = body.lang === "en" ? "en" : "ro";

  try {
    const { error } = await supabaseAdmin()
      .from("leads")
      .insert({
        source: "telegram",
        kind: "quote",
        name: lead.name || user.first_name,
        phone: lead.phone,
        project_type: lead.projectType,
        area: lead.area || null,
        comment: lead.comment || null,
        lang,
        telegram_user_id: user.id,
        telegram_username: user.username ?? null,
      });
    if (error) throw error;
  } catch (e) {
    console.error("[tg] save failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  after(() =>
    notifyTelegram(leadMessage(lead, lang, "Telegram Mini App")).catch((e) =>
      console.error("[telegram] send failed:", e instanceof Error ? e.name : e),
    ),
  );

  return NextResponse.json({ ok: true });
}
