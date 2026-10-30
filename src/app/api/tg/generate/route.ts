import { NextResponse } from "next/server";
import { isStyle } from "@/lib/design-styles";
import { generate, history, quotaFor, type Owner } from "@/lib/generations";
import { fullName, telegramUserFrom, type TelegramUser } from "@/lib/telegram-webapp";

// Design visualizations for clients in the Telegram Mini App. The browser
// talks only to this route; the OpenAI key stays on the server. Each Telegram
// account has its own daily limit and sees only its own history.

export const maxDuration = 120;

const noStore = { "Cache-Control": "private, no-store" };
const ownerOf = (u: TelegramUser): Owner => ({ kind: "telegram", id: String(u.id), label: fullName(u) });

export async function GET(req: Request) {
  const user = telegramUserFrom(req);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const owner = ownerOf(user);
    const [items, quota] = await Promise.all([history(owner, 20), quotaFor(owner)]);
    return NextResponse.json({ ok: true, items, quota }, { headers: noStore });
  } catch (e) {
    console.error("[image] load failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = telegramUserFrom(req);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }

  const style = form.get("style");
  const photo = form.get("photo");
  const res = await generate(ownerOf(user), {
    prompt: String(form.get("prompt") ?? ""),
    style: isStyle(style) ? style : "modern",
    photo: photo instanceof File ? photo : null,
  });

  if (res.ok) return NextResponse.json({ ok: true, item: res.generation, quota: res.quota }, { headers: noStore });

  const status = { limit: 429, prompt: 400, photo: 400, blocked: 422, busy: 503, no_key: 503, failed: 502 }[
    res.error.code
  ];
  return NextResponse.json({ ok: false, ...res.error }, { status, headers: noStore });
}
