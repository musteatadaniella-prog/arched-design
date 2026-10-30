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
