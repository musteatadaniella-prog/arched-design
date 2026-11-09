import "server-only";
import { company } from "./company";
import { renderInvoicePdf } from "./invoice-pdf";
import { supabaseAdmin } from "./supabase-admin";
import { escapeHtml, sendTelegramDocument } from "./telegram";

// Server side of invoices: draws the PDF once, stores it in the private
// "invoices" bucket and sends it to the client in Telegram. Invoice rows
// themselves are created in the database (create_invoice / the stage trigger).

const BUCKET = "invoices";

type Row = {
  id: number;
  number: string;
  lead_id: string;
  issued_on: string;
  due_on: string;
  currency: string;
  total: number | string;
  pdf_path: string | null;
  invoice_items: { position: number; title: string; qty: number | string; unit_price: number | string; amount: number | string }[];
  leads: {
    name: string;
    phone: string | null;
    email: string | null;
    telegram_user_id: number | null;
    telegram_username: string | null;
  } | null;
};

async function load(id: number) {
  const { data, error } = await supabaseAdmin()
    .from("invoices")
    .select(
      "id, number, lead_id, issued_on, due_on, currency, total, pdf_path, invoice_items(position, title, qty, unit_price, amount), leads(name, phone, email, telegram_user_id, telegram_username)",
    )
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) throw new Error(error.message);
  return data;
}

const fileName = (number: string) => `Factura_${number}.pdf`;

// Returns the stored PDF, drawing and uploading it the first time.
export async function invoicePdf(id: number): Promise<{ path: string; bytes: Uint8Array; row: Row } | null> {
  const row = await load(id);
  if (!row || !row.leads) return null;
  const storage = supabaseAdmin().storage.from(BUCKET);

  if (row.pdf_path) {
    const { data, error } = await storage.download(row.pdf_path);
    if (!error && data) return { path: row.pdf_path, bytes: new Uint8Array(await data.arrayBuffer()), row };
    console.error("[invoice] stored pdf missing, redrawing:", error?.message);
  }

  const lead = row.leads;
  const bytes = await renderInvoicePdf(
    {
      number: row.number,
      issued_on: row.issued_on,
      due_on: row.due_on,
      currency: row.currency,
      total: Number(row.total),
      items: [...row.invoice_items]
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ title: i.title, qty: Number(i.qty), unit_price: Number(i.unit_price), amount: Number(i.amount) })),
      client: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        telegram: lead.telegram_username ? `@${lead.telegram_username}` : null,
      },
    },
    company(),
  );

  const path = `${row.lead_id}/${fileName(row.number)}`;
  const { error: upErr } = await storage.upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);
  await supabaseAdmin().from("invoices").update({ pdf_path: path }).eq("id", id);
  return { path, bytes, row };
}

// One-minute link for opening the PDF from the card.
export async function invoicePdfUrl(id: number): Promise<string | null> {
  const pdf = await invoicePdf(id);
  if (!pdf) return null;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(pdf.path, 60);
  if (error || !data) throw new Error(error?.message ?? "signed url failed");
  return data.signedUrl;
}

const day = (iso: string) => iso.split("-").reverse().join(".");
const money = (n: number, cur: string) =>
  `${new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${cur}`;

// Sends the invoice to the client's Telegram and records the outcome.
export async function sendInvoice(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const pdf = await invoicePdf(id);
  if (!pdf) return { ok: false, error: "Factura nu există." };
  const { row, bytes } = pdf;
  const db = supabaseAdmin();

  const chat = row.leads?.telegram_user_id;
  if (!chat) {
    const error = "Clientul nu are Telegram (nu a scris din Mini App).";
    await db.from("invoices").update({ send_error: error }).eq("id", id);
    return { ok: false, error };
  }

  const caption = [
    `<b>Factura ${escapeHtml(row.number)}</b> de la Arched Design`,
    `Suma: <b>${money(Number(row.total), row.currency)}</b>`,
    `Termen de plată: ${day(row.due_on)}`,
    "",
    "Mulțumim! Pentru întrebări răspundeți la acest mesaj.",
  ].join("\n");

  const res = await sendTelegramDocument(chat, bytes, fileName(row.number), caption);
  if (!res.ok) {
    const error = `Telegram: ${res.error}`;
    console.error("[invoice] send failed:", row.number, res.error);
    await db.from("invoices").update({ send_error: error }).eq("id", id);
    return { ok: false, error };
  }
  await db
    .from("invoices")
    .update({ sent_at: new Date().toISOString(), sent_via: "telegram", send_error: null })
    .eq("id", id);
  return { ok: true };
}

// After a stage change: draws and sends any automatic invoice the database
// trigger has just created for this card. Safe to call more than once.
export async function deliverAutoInvoices(leadId: string) {
  const { data, error } = await supabaseAdmin()
    .from("invoices")
    .select("id")
    .eq("lead_id", leadId)
    .not("auto_stage", "is", null)
    .is("sent_at", null)
    .is("send_error", null);
  if (error) return console.error("[invoice] auto lookup failed:", error.message);
  for (const { id } of data ?? []) {
    await sendInvoice(id).catch((e) => console.error("[invoice] auto send failed:", e instanceof Error ? e.message : e));
  }
}
