"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { updateStatus } from "./actions";
import {
  SOURCE_LABEL,
  STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  dateFmt,
  type LeadSource,
  type LeadStatus,
} from "./statuses";

export type BoardCard = {
  id: string;
  created_at: string;
  status: LeadStatus;
  source: LeadSource;
  name: string;
  phone: string;
  project_type: string | null;
};

// Kanban board: drag a card to another column, or use the stage picker on the
// card (works on phones, where drag and drop does not).
export function Board({ leads }: { leads: BoardCard[] }) {
  const [cards, setCards] = useState(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();

  // Fresh server data after revalidation replaces the optimistic state.
  useEffect(() => setCards(leads), [leads]);

  function move(id: string, to: LeadStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    const prev = cards;
    setCards(cards.map((c) => (c.id === id ? { ...c, status: to } : c)));
    setFailed(false);
    start(async () => {
      const res = await updateStatus(id, to);
      if (!res.ok) {
        setCards(prev);
        setFailed(true);
      }
    });
  }

  return (
    <>
      {failed && (
        <p role="alert" className="mt-4 text-sm text-[#b4533f]">
          Nu am putut muta cardul. Încercați din nou.
        </p>
      )}
      <div className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
        {STATUSES.map((stage) => {
          const list = cards.filter((c) => c.status === stage);
          return (
            <section
              key={stage}
              aria-label={STATUS_LABEL[stage]}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, stage);
                setDragId(null);
                setOver(null);
              }}
              className={`flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col border bg-surface/60 transition-colors sm:w-[260px] lg:w-auto lg:flex-1 ${
                over === stage ? "border-ink" : "border-line"
              }`}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
                <span
                  className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[stage]}`}
                >
                  {STATUS_LABEL[stage]}
                </span>
                <span className="font-mono text-xs text-muted">{list.length}</span>
              </header>

              <ul className="flex min-h-32 flex-1 flex-col gap-2 p-2">
                {list.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    className={`cursor-grab border border-line bg-surface p-3 active:cursor-grabbing ${
                      dragId === c.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {dateFmt.format(new Date(c.created_at))} · {SOURCE_LABEL[c.source] ?? c.source}
                    </p>
                    <Link
                      href={`/admin/leads/${c.id}`}
                      className="mt-1 block break-words font-display text-lg uppercase leading-tight underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="mt-1 text-sm text-ink-soft">{c.phone}</p>
                    {c.project_type && <p className="mt-0.5 text-xs text-muted">{c.project_type}</p>}
                    <select
                      aria-label={`Etapa pentru ${c.name}`}
                      value={c.status}
                      onChange={(e) => move(c.id, e.target.value as LeadStatus)}
                      className="mt-3 w-full cursor-pointer border border-line bg-transparent px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] outline-none focus:border-ink"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-surface text-ink">
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
                {list.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted">Gol</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
