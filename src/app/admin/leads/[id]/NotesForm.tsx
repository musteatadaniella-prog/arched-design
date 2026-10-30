"use client";

import { useActionState } from "react";
import { saveNotes, type NotesState } from "../../actions";

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  const [state, action, pending] = useActionState<NotesState, FormData>(saveNotes.bind(null, id), {});

  return (
    <form action={action} className="mt-4">
      <textarea
        name="notes"
        defaultValue={notes}
        rows={7}
        maxLength={5000}
        placeholder="Ce s-a discutat, următorii pași…"
        className="w-full resize-y border border-line bg-transparent p-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-ink"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={pending}
          className="bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-surface transition-opacity disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Salvează"}
        </button>
        {state.ok && !pending && <span className="text-xs text-ink-soft">Salvat</span>}
        {state.error && (
          <span role="alert" className="text-xs text-[#b4533f]">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
