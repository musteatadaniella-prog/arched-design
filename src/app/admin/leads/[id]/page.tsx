import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { AdminHeader } from "../../AdminHeader";
import { StatusSelect } from "../../StatusSelect";
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  dateFmt,
  isStatus,
  type LeadSource,
  type LeadStatus,
} from "../../statuses";
import { NotesForm } from "./NotesForm";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  created_at: string;
  status: LeadStatus;
  source: LeadSource;
  kind: "quote" | "meeting" | null;
  name: string;
  phone: string;
  email: string | null;
  project_type: string | null;
  area: string | null;
  comment: string | null;
  notes: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  lang: string | null;
  document_path?: string | null;
};

type Step = {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const label = (s: string | null) => (s && isStatus(s) ? STATUS_LABEL[s] : s ?? "");

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [{ data: lead }, { data: history }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle<Lead>(),
    supabase
      .from("lead_stage_history")
      .select("id, from_status, to_status, changed_at, changed_by")
      .eq("lead_id", id)
      .order("changed_at", { ascending: true })
      .returns<Step[]>(),
  ]);
  if (!lead) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <AdminHeader title="Fișa clientului" email={user.email} />

      <Link
        href="/admin"
        className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft hover:text-ink"
      >
        ← Pâlnie
      </Link>

      <section className="mt-4 border border-line bg-surface p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
              Sursa: {SOURCE_LABEL[lead.source] ?? lead.source}
            </p>
            <h2 className="mt-1 break-words font-display text-3xl uppercase">{lead.name}</h2>
          </div>
          <StatusSelect key={lead.status} id={lead.id} status={lead.status} />
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Field label="Telefon">
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-4 hover:underline">
              {lead.phone}
            </a>
          </Field>
          <Field label="Creat">{dateFmt.format(new Date(lead.created_at))}</Field>
          <Field label="Sursa">{SOURCE_LABEL[lead.source] ?? lead.source}</Field>
          {lead.kind && <Field label="Tip cerere">{lead.kind === "meeting" ? "Întâlnire" : "Ofertă"}</Field>}
          {lead.email && (
            <Field label="Email">
              <a href={`mailto:${lead.email}`} className="break-all underline-offset-4 hover:underline">
                {lead.email}
              </a>
            </Field>
          )}
          {lead.project_type && <Field label="Proiect">{lead.project_type}</Field>}
          {lead.area && <Field label="Suprafață">{lead.area} m²</Field>}
          {lead.meeting_date && (
            <Field label="Întâlnire">
              {lead.meeting_date.split("-").reverse().join(".")} {lead.meeting_time}
            </Field>
          )}
          {lead.lang && <Field label="Limba">{lead.lang.toUpperCase()}</Field>}
          {lead.document_path && (
            <Field label="Document original">
              <a
                href={`/admin/leads/${lead.id}/document`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-ink-soft"
              >
                Deschide originalul ↗
              </a>
            </Field>
          )}
        </dl>

        {lead.comment && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Mesajul clientului</p>
            <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-soft">{lead.comment}</p>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="border border-line bg-surface p-5 sm:p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Notițe</h3>
          <NotesForm id={lead.id} notes={lead.notes ?? ""} />
        </section>

        <section className="border border-line bg-surface p-5 sm:p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Istoric etape</h3>
          {history && history.length > 0 ? (
            <ol className="mt-4 grid gap-3 border-l border-line pl-4">
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
          ) : (
            <p className="mt-4 text-sm text-muted">Fără istoric.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
