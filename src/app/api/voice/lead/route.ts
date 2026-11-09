import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyTelegram, voiceLeadMessage } from "@/lib/telegram";

// Webhook for the ElevenLabs voice agent's create_lead tool. Saves the caller's
// name, phone and a short summary of the conversation as a CRM lead with the
// source "voice". Every request must carry the header
//   x-voice-secret: <VOICE_AGENT_SECRET>
// which only ElevenLabs knows; anything else gets 401, so nobody can post
// leads here directly.

export const dynamic = "force-dynamic";

function authorized(req: Request): "ok" | "unconfigured" | "denied" {
  const expected = process.env.VOICE_AGENT_SECRET;
  if (!expected || expected.length < 24) return "unconfigured";
  const a = Buffer.from(req.headers.get("x-voice-secret")?.trim() ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(req: Request) {
  const auth = authorized(req);
  if (auth === "unconfigured") {
    console.error("[voice] VOICE_AGENT_SECRET is not set (or shorter than 24 chars)");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  if (auth === "denied") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const name = str(body.name);
  const phone = str(body.phone);
  const summary = str(body.summary);
  const lang = ["ro", "en", "ru"].includes(str(body.lang)) ? str(body.lang) : "ro";

  // The agent reads these messages back to the caller, so they say what to fix.
  const digits = phone.replace(/\D/g, "");
  const errors: string[] = [];
  if (name.length < 2 || name.length > 100) errors.push("name: ask the caller for their name");
  if (!/^[+\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15)
    errors.push("phone: ask the caller to repeat the phone number (7–15 digits)");
  if (summary.length < 5) errors.push("summary: add a short summary of what the caller needs");
  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const comment = summary.slice(0, 2000);

  try {
    // status and created_at come from the table defaults ('new', now()).
    const { error } = await supabaseAdmin()
      .from("leads")
      .insert({ source: "voice", kind: null, name, phone, comment, lang });
    if (error) throw error;
  } catch (e) {
    console.error("[voice] save failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  revalidatePath("/admin");
  after(() =>
    notifyTelegram(voiceLeadMessage({ name, phone, summary: comment, lang })).catch((e) =>
      console.error("[telegram] send failed:", e instanceof Error ? e.name : e),
    ),
  );

  return NextResponse.json({ ok: true, message: "Lead saved. Tell the caller the team will call back within one working day." });
}
