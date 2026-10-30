"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SOURCE_LABEL,
  STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  dateFmt,
  isStatus,
  type LeadSource,
  type LeadStatus,
} from "@/app/admin/statuses";

// The CRM funnel for staff inside the Mini App: stage tabs, client cards and
// stage change. The same data as /admin, served only to TELEGRAM_STAFF_IDS.

type Api = (path: string, init?: RequestInit) => Promise<Response>;

type Card = {
  id: string;
  created_at: string;
  status: LeadStatus;
  source: LeadSource;
  name: string;
  phone: string;
  project_type: string | null;
};

type Lead = Card & {
  kind: "quote" | "meeting" | null;
  email: string | null;
  area: string | null;
  comment: string | null;
  notes: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  telegram_username: string | null;
};

type Step = { id: number; from_status: string | null; to_status: string; changed_at: string; changed_by: string | null };

const label = (s: string | null) => (s && isStatus(s) ? STATUS_LABEL[s] : (s ?? ""));
const red = "text-[#b4533f]";

export function CrmView({ api, haptic }: { api: Api; haptic: (ok: boolean) => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [stage, setStage] = useState<LeadStatus>("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await api("/api/tg/crm");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error("load");
    setCards(data.leads);
  }, [api]);

  useEffect(() => {
    load().catch(() => setFailed(true));
  }, [load]);

  if (failed) return <p className={`mt-8 text-sm ${red}`}>Nu am putut încărca pâlnia. Redeschideți aplicația.</p>;
  if (!cards) return <p className="mt-8 text-sm text-muted">Se încarcă…</p>;

  if (openId) {
    return (
      <LeadCard
        id={openId}
        api={api}
        haptic={haptic}
        onBack={() => setOpenId(null)}
        onMoved={(id, to) => setCards((cs) => cs?.map((c) => (c.id === id ? { ...c, status: to } : c)) ?? cs)}
      />
    );
  }

  const shown = cards.filter((c) => c.status === stage);

  return (
    <section className="mt-6">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {STATUSES.map((s) => {
          const count = cards.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              aria-pressed={stage === s}
              className={`shrink-0 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] ${
                stage === s ? STATUS_TONE[s] : "border-line bg-surface text-ink-soft"
              }`}
            >
              {STATUS_LABEL[s]} · {count}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Niciun client în această etapă.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpenId(c.id)}
                className="w-full border border-line bg-surface p-4 text-left active:bg-bg"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words font-display text-lg uppercase">{c.name}</p>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {SOURCE_LABEL[c.source] ?? c.source}
                  </span>
                </div>
                {c.project_type && <p className="mt-1 break-words text-sm text-ink-soft">{c.project_type}</p>}
                <p className="mt-2 font-mono text-[11px] text-muted">
                  {c.phone} · {dateFmt.format(new Date(c.created_at))}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LeadCard({
  id,
  api,
  haptic,
  onBack,
  onMoved,
}: {
  id: string;
  api: Api;
  haptic: (ok: boolean) => void;
  onBack: () => void;
  onMoved: (id: string, to: LeadStatus) => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<Step[]>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<LeadStatus | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await api(`/api/tg/crm/${id}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error("load");
    setLead(data.lead);
    setHistory(data.history);
  }, [api, id]);

  useEffect(() => {
    load().catch(() => setFailed(true));
  }, [load]);

  async function move(to: LeadStatus) {
    if (!lead || lead.status === to || saving) return;
    setSaving(to);
    setSaveFailed(false);
    try {
      const res = await api(`/api/tg/crm/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) throw new Error("save");
      haptic(true);
      onMoved(id, to);
      await load();
    } catch {
      haptic(false);
      setSaveFailed(true);
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft"
      >
        ← Pâlnie
      </button>

      {failed && <p className={`mt-6 text-sm ${red}`}>Nu am putut deschide fișa.</p>}
      {!lead && !failed && <p className="mt-6 text-sm text-muted">Se încarcă…</p>}

      {lead && (
        <>
          <div className="mt-4 border border-line bg-surface p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Sursa: {SOURCE_LABEL[lead.source] ?? lead.source}
            </p>
            <h2 className="mt-1 break-words font-display text-3xl uppercase">{lead.name}</h2>

            <dl className="mt-4 grid gap-3 text-sm">
              <Row label="Telefon">
                <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4">
                  {lead.phone}
                </a>
              </Row>
              {lead.telegram_username && (
                <Row label="Telegram">
                  <a href={`https://t.me/${lead.telegram_username}`} className="underline underline-offset-4">
                    @{lead.telegram_username}
                  </a>
                </Row>
              )}
              {lead.email && (
                <Row label="Email">
                  <a href={`mailto:${lead.email}`} className="break-all underline underline-offset-4">
                    {lead.email}
                  </a>
                </Row>
              )}
              {lead.project_type && <Row label="Serviciu">{lead.project_type}</Row>}
              {lead.area && <Row label="Suprafață">{lead.area} m²</Row>}
              {lead.meeting_date && (
                <Row label="Întâlnire">
                  {lead.meeting_date.split("-").reverse().join(".")} {lead.meeting_time}
                </Row>
              )}
              <Row label="Creat">{dateFmt.format(new Date(lead.created_at))}</Row>
            </dl>

            {lead.comment && (
              <p className="mt-4 whitespace-pre-line break-words border-t border-line pt-3 text-sm text-ink-soft">
                {lead.comment}
              </p>
            )}
            {lead.notes && (
              <p className="mt-4 whitespace-pre-line break-words border-t border-line pt-3 text-sm text-ink-soft">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Notițe: </span>
                {lead.notes}
              </p>
            )}
          </div>

          <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Mută în etapa</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving !== null}
                onClick={() => move(s)}
                aria-pressed={lead.status === s}
                className={`border px-3 py-3 font-mono text-[11px] uppercase tracking-[0.12em] disabled:opacity-60 ${
                  lead.status === s ? STATUS_TONE[s] : "border-line bg-surface text-ink"
                }`}
              >
                {saving === s ? "…" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {saveFailed && (
            <p role="alert" className={`mt-2 text-sm ${red}`}>
              Nu am putut schimba etapa. Încercați din nou.
            </p>
          )}

          <h3 className="mt-8 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Istoric etape</h3>
          <ol className="mt-3 grid gap-3 border-l border-line pl-4">
            {history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink" aria-hidden />
                <p className="font-mono text-[11px] text-muted">{dateFmt.format(new Date(h.changed_at))}</p>
                <p className="mt-0.5">
                  {h.from_status ? (
                    <>
                      {label(h.from_status)} → <strong>{label(h.to_status)}</strong>
                    </>
                  ) : (
                    <>
                      Creat în etapa <strong>{label(h.to_status)}</strong>
                    </>
                  )}
                </p>
                {h.changed_by && <p className="text-xs text-muted">{h.changed_by}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
