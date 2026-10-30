import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signOut } from "./actions";

export function AdminHeader({ title, email }: { title: string; email?: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
      <Link href="/admin" className="flex items-center gap-4">
        <Logo className="h-10 w-10 text-ink" strokeWidth={7} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">ARCHED design · CRM</p>
          <h1 className="font-display text-2xl uppercase sm:text-3xl">{title}</h1>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/scan"
          className="border border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-ink hover:text-surface"
        >
          Scanează carte de vizită
        </Link>
        <Link
          href="/admin/generate"
          className="border border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-ink hover:text-surface"
        >
          Vizualizare AI
        </Link>
        <Link
          href="/admin/leads/new"
          className="bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-surface transition-opacity hover:opacity-85"
        >
          + Client nou
        </Link>
        <form action={signOut} className="flex items-center gap-4">
          {email && <span className="hidden text-sm text-ink-soft md:inline">{email}</span>}
          <button className="border border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-ink hover:text-surface">
            Ieșire
          </button>
        </form>
      </div>
    </header>
  );
}
