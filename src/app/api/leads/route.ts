import { NextResponse, after } from "next/server";
import { validateLead } from "@/lib/lead";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { leadMessage, notifyTelegram } from "@/lib/telegram";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const { lead, errors } = validateLead(body);

  // Bots fill the hidden field; pretend success so they move on.
  if (lead.website) return NextResponse.json({ ok: true });

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const lang = (body as { lang?: unknown }).lang === "en" ? "en" : "ro";

  try {
    // status and created_at come from the table defaults ('new', now()).
    const { error } = await supabaseAdmin()
      .from("leads")
      .insert({
        kind: lead.kind,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || null,
        project_type: lead.projectType || null,
        area: lead.area || null,
        comment: lead.comment || null,
        meeting_date: lead.kind === "meeting" ? lead.meetingDate : null,
        meeting_time: lead.kind === "meeting" ? lead.meetingTime : null,
        lang,
      });
    if (error) throw error;
  } catch (e) {
    console.error("[lead] save failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  // Runs after the response is sent, so the visitor never waits on Telegram;
  // a Telegram outage is logged but the lead is already saved.
  after(() =>
    notifyTelegram(leadMessage(lead, lang)).catch((e) =>
      console.error("[telegram] send failed:", e instanceof Error ? e.name : e),
    ),
  );

  return NextResponse.json({ ok: true });
}
