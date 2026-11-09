import "server-only";
import type { LeadInput } from "./lead";

// Sends the owner a Telegram message about a new lead. The bot token and
// chat id live only in environment variables (.env.local / Vercel).

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function leadMessage(lead: LeadInput, lang: string, via = "site") {
  const when = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Chisinau",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const lines = [
    `<b>${lead.kind === "meeting" ? "📅 Cerere de întâlnire" : "📐 Cerere de ofertă"}</b>`,
    "",
    `<b>Nume:</b> ${esc(lead.name)}`,
    `<b>Telefon:</b> ${esc(lead.phone)}`,
  ];
  if (lead.email) lines.push(`<b>Email:</b> ${esc(lead.email)}`);
  if (lead.projectType) lines.push(`<b>Proiect:</b> ${esc(lead.projectType)}`);
  if (lead.area) lines.push(`<b>Suprafață:</b> ${esc(lead.area)} m²`);
  if (lead.kind === "meeting" && lead.meetingDate) {
    lines.push(`<b>Întâlnire:</b> ${lead.meetingDate.split("-").reverse().join(".")} ${esc(lead.meetingTime ?? "")}`);
  }
  if (lead.comment) lines.push("", `<b>Comentariu:</b>`, esc(lead.comment));
  lines.push("", `<i>${when} · ${lang.toUpperCase()} · ${esc(via)} · status: nouă</i>`);
  return lines.join("\n");
}

// A request left by the voice agent on the site: who called and what they asked.
export function voiceLeadMessage(v: { name: string; phone: string; summary: string; lang: string }) {
  const when = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Chisinau",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  return [
    "<b>🎙️ Cerere de la agentul vocal</b>",
    "",
    `<b>Nume:</b> ${esc(v.name)}`,
    `<b>Telefon:</b> ${esc(v.phone)}`,
    "",
    "<b>Rezumatul discuției:</b>",
    esc(v.summary),
    "",
    `<i>${when} · ${v.lang.toUpperCase()} · voce · status: nouă</i>`,
  ].join("\n");
}

export async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set");
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    // Log only Telegram's description, never the URL (it contains the token).
    const body = (await res.json().catch(() => null)) as { description?: string } | null;
    console.error("[telegram] send failed:", res.status, body?.description ?? "");
  }
}

// Sends a file (e.g. an invoice PDF) to a Telegram chat. The client must have
// pressed Start in the bot once (anyone who used the Mini App has).
export async function sendTelegramDocument(
  chatId: number | string,
  file: Uint8Array,
  filename: string,
  caption: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN nu este setat" };

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([file as BlobPart], { type: "application/pdf" }), filename);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return { ok: true };
    // Only Telegram's description, never the URL (it contains the token).
    const body = (await res.json().catch(() => null)) as { description?: string } | null;
    return { ok: false, error: body?.description ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "network error" };
  }
}

export const escapeHtml = esc;
