"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createInvoice, markInvoicePaid, resendInvoice, type InvoiceState } from "../../actions";

export type Invoice = {
  id: number;
  number: string;
  issued_on: string;
  due_on: string;
  currency: string;
  total: number;
  status: "unpaid" | "paid";
  paid_at: string | null;
  auto_stage: string | null;
  sent_at: string | null;
  sent_via: string | null;
  send_error: string | null;
};

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
const day = (iso: string) => iso.split("-").reverse().join(".");
const when = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Chisinau",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const input =
  "w-full min-w-0 border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-ink";
const label = "font-mono text-[10px] uppercase tracking-[0.15em] text-muted";
const button =
  "bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-surface transition-opacity disabled:opacity-60";
const link = "font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft hover:text-ink disabled:opacity-60";

type Line = { key: number; title: string; qty: string; price: string };

export function Invoices({
  leadId,
  invoices,
  defaultTitle,
  defaultPrice,
  currency,
  hasTelegram,
  dueDays,
}: {
  leadId: string;
  invoices: Invoice[];
  defaultTitle: string;
  defaultPrice: number | null;
  currency: string;
  hasTelegram: boolean;
  dueDays: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<InvoiceState, FormData>(createInvoice.bind(null, leadId), {});
  const fresh = (): Line[] => [
    { key: 1, title: defaultTitle, qty: "1", price: defaultPrice && defaultPrice > 0 ? String(defaultPrice) : "" },
  ];
  const [lines, setLines] = useState<Line[]>(fresh);

  // Close the form after a successful invoice.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.qty.replace(",", ".")) || 0) * (Number(l.price.replace(",", ".")) || 0), 0);

  return (
    <div className="mt-4 grid gap-5">
      {invoices.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} leadId={leadId} inv={inv} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nicio factură încă.</p>
      )}

      {state.message && !pending && (
        <p role="status" className={`text-sm ${state.message.includes("nu s-a trimis") ? "text-[#b4533f]" : "text-ink-soft"}`}>
          {state.message}
        </p>
      )}

      {!open ? (
        <div>
          <button
            type="button"
            className={button}
            onClick={() => {
              setLines(fresh());
              setOpen(true);
            }}
          >
            Emite factura
          </button>
        </div>
      ) : (
        <form action={action} className="grid gap-3 border border-line p-4">
          <span className={label}>Poziții</span>
          {lines.map((l, i) => (
            <div key={l.key} className="grid gap-2 sm:grid-cols-[1fr_80px_120px_auto]">
              <input
                name="title"
                value={l.title}
                onChange={(e) => setLine(l.key, { title: e.target.value })}
                maxLength={200}
                placeholder="Serviciu sau produs"
                aria-label={`Denumire, rândul ${i + 1}`}
                className={input}
              />
              <input
                name="qty"
                value={l.qty}
                onChange={(e) => setLine(l.key, { qty: e.target.value })}
                inputMode="decimal"
                placeholder="Cant."
                aria-label={`Cantitate, rândul ${i + 1}`}
                className={input}
              />
              <input
                name="price"
                value={l.price}
                onChange={(e) => setLine(l.key, { price: e.target.value })}
                inputMode="decimal"
                placeholder={`Preț, ${currency}`}
                aria-label={`Preț, rândul ${i + 1}`}
                className={input}
              />
              <button
                type="button"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                className={`${link} justify-self-start px-1`}
                aria-label={`Șterge rândul ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={lines.length >= 20}
              onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, title: "", qty: "1", price: "" }])}
              className={link}
            >
              + Adaugă poziție
            </button>
            <p className="text-sm">
              Total: <strong>{money(total, currency)}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              Termen de plată
              <input
                name="due_days"
                type="number"
                min={0}
                max={365}
                defaultValue={dueDays}
                className="w-16 border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-ink"
              />
              zile
            </label>
            <label className={`flex items-center gap-2 ${hasTelegram ? "" : "text-muted"}`}>
              <input name="send" type="checkbox" defaultChecked={hasTelegram} disabled={!hasTelegram} />
              Trimite clientului în Telegram
              {!hasTelegram && <span className="text-xs">(clientul nu are Telegram)</span>}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={pending} className={button}>
              {pending ? "Se emite…" : "Emite și salvează PDF"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={link}>
              Anulează
            </button>
            {state.error && !pending && (
              <span role="alert" className="text-xs text-[#b4533f]">
                {state.error}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function InvoiceRow({ leadId, inv }: { leadId: string; inv: Invoice }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const paid = inv.status === "paid";

  return (
    <li className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong>{inv.number}</strong>
          <span className="font-mono text-[11px] text-muted">{day(inv.issued_on)}</span>
          <span>{money(inv.total, inv.currency)}</span>
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
              paid ? "border-ink text-ink" : "border-sand bg-sand/40 text-ink"
            }`}
          >
            {paid ? "Achitată" : "Neachitată"}
          </span>
          {inv.auto_stage && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">automat</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {paid && inv.paid_at
            ? `Achitată ${when.format(new Date(inv.paid_at))}`
            : `De plată până la ${day(inv.due_on)}`}
          {" · "}
          {inv.sent_at ? (
            `Trimisă în Telegram ${when.format(new Date(inv.sent_at))}`
          ) : inv.send_error ? (
            <span className="text-[#b4533f]">Netrimisă: {inv.send_error}</span>
          ) : (
            "Netrimisă"
          )}
        </p>
        {error && (
          <p role="alert" className="text-xs text-[#b4533f]">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <a href={`/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className={link}>
          PDF ↗
        </a>
        <button
          type="button"
          disabled={pending}
          className={link}
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await resendInvoice(leadId, inv.id);
              if (!res.ok) setError(res.error ?? "Nu am putut trimite.");
            });
          }}
        >
          {inv.sent_at ? "Retrimite" : "Trimite"}
        </button>
        {!paid && (
          <button
            type="button"
            disabled={pending}
            onBlur={() => setConfirm(false)}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              setError(null);
              start(async () => {
                const res = await markInvoicePaid(leadId, inv.id);
                if (!res.ok) setError("Nu am putut marca achitarea.");
                setConfirm(false);
              });
            }}
            className={`bg-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-surface disabled:opacity-60`}
          >
            {pending ? "…" : confirm ? "Confirmă" : "Marchează achitată"}
          </button>
        )}
      </div>
    </li>
  );
}
