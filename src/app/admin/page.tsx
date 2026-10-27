import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabase-server";
import { signOut } from "./actions";
import { StatusSelect } from "./StatusSelect";
import { STATUSES, STATUS_LABEL, isStatus, type LeadStatus } from "./statuses";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  created_at: string;
  status: LeadStatus;
  kind: "quote" | "meeting";
  name: string;
  phone: string;
  email: string | null;
  project_type: string | null;
  area: string | null;
  comment: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  lang: string | null;
};

const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Chisinau",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { status } = await searchParams;
  const filter = isStatus(status) ? status : null;

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
  if (filter) query = query.eq("status", filter);

  const [{ data: leads, error }, { data: all }] = await Promise.all([
    query.returns<Lead[]>(),
    supabase.from("leads").select("status").returns<{ status: LeadStatus }[]>(),
  ]);

  const counts = { all: all?.length ?? 0 } as Record<LeadStatus | "all", number>;
  for (const s of STATUSES) counts[s] = all?.filter((l) => l.status === s).length ?? 0;

  const tabs: { key: LeadStatus | null; label: string; count: number }[] = [
    { key: null, label: "Toate", count: counts.all },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], count: counts[s] })),
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Logo className="h-10 w-10 text-ink" strokeWidth={7} />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">ARCHED design</p>
            <h1 className="font-display text-2xl uppercase sm:text-3xl">Cereri</h1>
          </div>
        </div>
        <form action={signOut} className="flex items-center gap-4">
          <span className="hidden text-sm text-ink-soft sm:inline">{user.email}</span>
          <button className="border border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-ink hover:text-surface">
            Ieșire
          </button>
        </form>
      </header>

      <nav aria-label="Filtru după status" className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.key === filter;
          return (
            <Link
              key={t.label}
              href={t.key ? `/admin?status=${t.key}` : "/admin"}
              aria-current={active ? "page" : undefined}
              className={`border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
                active ? "border-ink bg-ink text-surface" : "border-line hover:border-ink"
              }`}
            >
              {t.label} <span className="opacity-60">{t.count}</span>
            </Link>
          );
        })}
      </nav>

      {error && (
        <p role="alert" className="mt-8 text-sm text-[#b4533f]">
          Nu am putut încărca cererile. Încercați din nou.
        </p>
      )}

      {!error && leads?.length === 0 && <p className="mt-12 text-ink-soft">Nu există cereri cu acest status.</p>}

      <ul className="mt-6 grid gap-3">
        {leads?.map((l) => (
          <li key={l.id} className="border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
                  {dateFmt.format(new Date(l.created_at))} · {l.kind === "meeting" ? "Întâlnire" : "Ofertă"}
                  {l.lang === "en" ? " · EN" : ""}
                </p>
                <h2 className="mt-1 break-words font-display text-xl uppercase">{l.name}</h2>
              </div>
              <StatusSelect id={l.id} status={l.status} />
            </div>

            <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Telefon">
                <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-4 hover:underline">
                  {l.phone}
                </a>
              </Field>
              {l.email && (
                <Field label="Email">
                  <a href={`mailto:${l.email}`} className="break-all underline-offset-4 hover:underline">
                    {l.email}
                  </a>
                </Field>
              )}
              {l.project_type && <Field label="Proiect">{l.project_type}</Field>}
              {l.area && <Field label="Suprafață">{l.area} m²</Field>}
              {l.meeting_date && (
                <Field label="Întâlnire">
                  {l.meeting_date.split("-").reverse().join(".")} {l.meeting_time}
                </Field>
              )}
            </dl>

            {l.comment && (
              <p className="mt-4 whitespace-pre-line break-words border-t border-line pt-4 text-sm text-ink-soft">
                {l.comment}
              </p>
            )}
          </li>
        ))}
      </ul>
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
