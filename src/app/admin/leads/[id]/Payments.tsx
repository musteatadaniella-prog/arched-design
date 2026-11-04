"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addPayment, deletePayment, saveContract, type MoneyState } from "../../actions";

export type Payment = {
  id: number;
  amount: number;
  paid_on: string;
  note: string | null;
  created_by: string | null;
};

const CURRENCIES = ["EUR", "MDL", "USD"] as const;

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);

const plain = (n: number | null) =>
  n == null ? "" : new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2, useGrouping: false }).format(n);

const day = (iso: string) => iso.split("-").reverse().join(".");

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(new Date());

const input =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-ink";
const label = "font-mono text-[10px] uppercase tracking-[0.15em] text-muted";
const button =
  "bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-surface transition-opacity disabled:opacity-60";

export function Payments({
  id,
  amount,
  currency,
  payments,
}: {
  id: string;
  amount: number | null;
  currency: string;
  payments: Payment[];
}) {
  const [contract, contractAction, savingContract] = useActionState<MoneyState, FormData>(
    saveContract.bind(null, id),
    {},
  );
  const [added, addAction, adding] = useActionState<MoneyState, FormData>(addPayment.bind(null, id), {});
  const addForm = useRef<HTMLFormElement>(null);

  // Clear the payment form after a successful save.
  useEffect(() => {
    if (added.ok) addForm.current?.reset();
  }, [added]);

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const left = amount != null ? amount - paid : null;
  const pct = amount ? Math.min(100, Math.round((paid / amount) * 100)) : 0;

  return (
    <div className="mt-4 grid gap-6">
      <form action={contractAction} className="grid gap-2">
        <span className={label}>Suma contractului</span>
        <div className="flex flex-wrap gap-2">
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={plain(amount)}
            placeholder="ex. 12500"
            aria-label="Suma contractului"
            className={`${input} min-w-0 flex-1`}
          />
          <select
            name="currency"
            defaultValue={currency}
            aria-label="Valuta"
            className="border border-line bg-transparent px-2 py-2 font-mono text-xs outline-none focus:border-ink"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-surface text-ink">
                {c}
              </option>
            ))}
          </select>
          <button disabled={savingContract} className={button}>
            {savingContract ? "…" : "Salvează"}
          </button>
        </div>
        <Status state={contract} pending={savingContract} />
      </form>

      <div className="grid grid-cols-3 gap-3 border-y border-line py-4 text-sm">
        <Stat title="Contract">{amount != null ? money(amount, currency) : "—"}</Stat>
        <Stat title="Primit">{money(paid, currency)}</Stat>
        <Stat title="Rest de plată">
          <span className={left != null && left < 0 ? "text-[#b4533f]" : ""}>
            {left != null ? money(left, currency) : "—"}
          </span>
        </Stat>
        {amount ? (
          <div className="col-span-3">
            <div className="h-1.5 w-full bg-line" aria-hidden>
              <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 font-mono text-[10px] text-muted">{pct}% achitat</p>
          </div>
        ) : null}
      </div>

      <div>
        <span className={label}>Avansuri primite</span>
        {payments.length > 0 ? (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {payments.map((p) => (
              <PaymentRow key={p.id} leadId={id} payment={p} currency={currency} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nicio plată încă.</p>
        )}
      </div>

      <form ref={addForm} action={addAction} className="grid gap-2">
        <span className={label}>Adaugă plată</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="amount" inputMode="decimal" placeholder={`Suma, ${currency}`} aria-label="Suma primită" className={input} />
          <input name="paid_on" type="date" defaultValue={today()} aria-label="Data primirii" className={input} />
        </div>
        <input name="note" maxLength={300} placeholder="Comentariu (ex. avans 30%, transfer)" aria-label="Comentariu" className={input} />
        <div className="flex items-center gap-3">
          <button disabled={adding} className={button}>
            {adding ? "Se salvează…" : "Adaugă"}
          </button>
          <Status state={added} pending={adding} />
        </div>
      </form>
    </div>
  );
}

function PaymentRow({ leadId, payment: p, currency }: { leadId: string; payment: Payment; currency: string }) {
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p>
          <strong>{money(p.amount, currency)}</strong>
          <span className="ml-2 font-mono text-[11px] text-muted">{day(p.paid_on)}</span>
        </p>
        {p.note && <p className="break-words text-xs text-ink-soft">{p.note}</p>}
        {p.created_by && <p className="text-[11px] text-muted">{p.created_by}</p>}
        {failed && (
          <p role="alert" className="text-xs text-[#b4533f]">
            Nu am putut șterge plata.
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={pending}
        onBlur={() => setConfirm(false)}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          setFailed(false);
          start(async () => {
            const res = await deletePayment(leadId, p.id);
            if (!res.ok) setFailed(true);
            setConfirm(false);
          });
        }}
        className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:opacity-60 ${
          confirm ? "text-[#b4533f]" : "text-muted hover:text-ink"
        }`}
      >
        {pending ? "…" : confirm ? "Sigur?" : "Șterge"}
      </button>
    </li>
  );
}

function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={label}>{title}</p>
      <p className="mt-0.5 break-words font-medium">{children}</p>
    </div>
  );
}

function Status({ state, pending }: { state: MoneyState; pending: boolean }) {
  if (pending) return null;
  if (state.error)
    return (
      <span role="alert" className="text-xs text-[#b4533f]">
        {state.error}
      </span>
    );
  if (state.ok) return <span className="text-xs text-ink-soft">Salvat</span>;
  return null;
}
