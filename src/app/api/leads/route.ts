import { NextResponse } from "next/server";
import { validateLead } from "@/lib/lead";

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

  // Leads are only logged for now; saving to Supabase and the Telegram
  // notification are added in the next steps.
  console.log("[lead]", { kind: lead.kind, name: lead.name, at: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
