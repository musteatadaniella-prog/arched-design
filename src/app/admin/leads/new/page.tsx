"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { LeadErrorKey } from "@/lib/lead";
import { createLead, type NewLeadState } from "../../actions";

const inputCls =
  "w-full border-b border-line bg-transparent py-3 outline-none transition-colors placeholder:text-muted focus:border-ink";

const MESSAGE: Record<LeadErrorKey, string> = {
  required: "Câmp obligatoriu.",
  name: "Numele trebuie să aibă 2–100 de caractere.",
  phone: "Număr de telefon invalid.",
  email: "Email invalid.",
  slot: "Alegeți data și ora.",
  tooLong: "Text prea lung.",
};

export default function NewLeadPage() {
  const [state, action, pending] = useActionState<NewLeadState, FormData>(createLead, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-8 sm:py-12">
      <Link
        href="/admin"
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft hover:text-ink"
      >
        ← Pâlnie
      </Link>

      {/* key resets the uncontrolled inputs to the values the server sent back */}
      <form key={JSON.stringify(v)} action={action} className="mt-4 border border-line bg-surface p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Sursa: Manual</p>
        <h1 className="mt-1 font-display text-3xl uppercase">Client nou</h1>
        <p className="mt-2 text-sm text-ink-soft">Pentru clienți veniți prin apel sau la o întâlnire.</p>

        <Input label="Nume *" name="name" defaultValue={v.name} error={e.name} autoComplete="off" />
        <Input label="Telefon *" name="phone" type="tel" defaultValue={v.phone} error={e.phone} />
        <Input label="Email" name="email" type="email" defaultValue={v.email} error={e.email} />
        <Input label="Tip proiect" name="projectType" defaultValue={v.projectType} placeholder="Casă, interior, renovare…" />

        <label className="mt-6 block">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">Cum a venit / ce dorește</span>
          <textarea name="comment" rows={3} defaultValue={v.comment} className={`${inputCls} resize-y`} />
        </label>
        <label className="mt-6 block">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">Notițe</span>
          <textarea name="notes" rows={3} defaultValue={v.notes} className={`${inputCls} resize-y`} />
        </label>

        {e.form && (
          <p role="alert" className="mt-5 text-sm text-[#b4533f]">
            {e.form}
          </p>
        )}

        <button
          disabled={pending}
          className="mt-8 w-full bg-ink py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-surface transition-opacity disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Adaugă în pâlnie"}
        </button>
      </form>
    </main>
  );
}

function Input({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: LeadErrorKey }) {
  return (
    <label className="mt-6 block">
      <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">{label}</span>
      <input {...props} aria-invalid={error ? true : undefined} className={inputCls} />
      {error && <span className="mt-1 block text-xs text-[#b4533f]">{MESSAGE[error]}</span>}
    </label>
  );
}
