"use client";

import { useEffect, useState, useTransition } from "react";
import { STYLES, STYLE_LABEL, isStyle, resetTime, type Style } from "@/lib/design-styles";
import type { Generation, Quota } from "@/lib/generations";
import { shrinkImage } from "@/lib/shrink-image";
import { generateDesign } from "./actions";

const MAX_BYTES = 4 * 1024 * 1024;
const red = "text-[#b4533f]";
const dateFmt = (iso: string) =>
  new Date(iso).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const limitMessage = (q: Quota) =>
  `Ați atins limita: ${q.limit} generări în 24 de ore.` +
  (q.resetAt ? ` Următoarea generare va fi disponibilă pe ${resetTime(q.resetAt, "ro")}.` : "");

export function GenerateForm({ initialItems, initialQuota }: { initialItems: Generation[]; initialQuota: Quota }) {
  const [items, setItems] = useState(initialItems);
  const [quota, setQuota] = useState(initialQuota);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<Style>("modern");
  const [result, setResult] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(file: File | undefined) {
    setError(null);
    setPhoto(null);
    setPreview(null);
    if (!file) return;
    try {
      const ready = await shrinkImage(file);
      if (ready.size > MAX_BYTES) throw new Error("size");
      setPhoto(ready);
      setPreview(URL.createObjectURL(ready));
    } catch {
      setError("Nu pot deschide această imagine. Folosiți JPG, PNG sau WEBP.");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (prompt.trim().length < 3) return setError("Descrieți ce doriți să vedeți.");
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("style", style);
    if (photo) form.set("photo", photo);
    setError(null);
    setResult(null);
    start(async () => {
      const res = await generateDesign(form);
      if (res.quota) setQuota(res.quota);
      if (res.generation) {
        setResult(res.generation);
        setItems((list) => [res.generation!, ...list]);
      } else if (res.error === "limit" && res.quota) setError(limitMessage(res.quota));
      else setError(res.error ?? "Generarea a eșuat.");
    });
  }

  return (
    <>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={onSubmit} className="border border-line bg-surface p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">GPT Image 2.5</p>
          <h2 className="mt-1 font-display text-2xl uppercase">Schiță nouă</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Încărcați fotografia spațiului (opțional) și descrieți dorințele clientului.
          </p>

          <label className="mt-5 inline-block cursor-pointer border border-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-ink hover:text-surface">
            {photo ? "Altă fotografie" : "Fotografia spațiului"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                void onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {photo && (
            <button
              type="button"
              onClick={() => void onPick(undefined)}
              className="ml-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft hover:text-ink"
            >
              Fără foto
            </button>
          )}

          <label className="mt-5 block">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Dorințe *</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Living luminos, canapea gri, podea din stejar, plante, lumină caldă seara"
              className="mt-1 w-full resize-y border border-line bg-white px-3 py-2.5 outline-none focus:border-ink"
            />
          </label>

          <fieldset className="mt-4">
            <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Stil</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={style === s}
                  onClick={() => setStyle(s)}
                  className={`border px-3 py-2 text-sm ${style === s ? "border-ink bg-ink text-surface" : "border-line"}`}
                >
                  {STYLE_LABEL.ro[s]}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
            Rămase: {quota.left} din {quota.limit} în 24 de ore
          </p>

          {error && (
            <p role="alert" className={`mt-4 border border-[#b4533f]/40 bg-[#b4533f]/5 p-4 text-sm ${red}`}>
              {error}
            </p>
          )}

          <button
            disabled={pending}
            className="mt-5 w-full bg-ink px-5 py-3.5 font-mono text-xs uppercase tracking-[0.15em] text-surface transition-opacity disabled:opacity-60"
          >
            {pending ? "Se generează… (până la un minut)" : "Generează"}
          </button>
        </form>

        <section className="grid gap-4 sm:grid-cols-2">
          <Figure title="Sursa" url={result?.sourceUrl ?? preview} empty={result ? "Doar descriere, fără foto" : "Fotografia apare aici"}>
            {result && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{result.prompt}</p>}
          </Figure>
          <Figure title="Rezultat" url={result?.resultUrl ?? null} empty={pending ? "Se generează…" : "Schița apare aici"} />
        </section>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl uppercase">Istoric generări</h2>
        <p className="mt-1 text-sm text-ink-soft">Toate schițele: din admin și de la clienții din Telegram.</p>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Încă nu există generări.</p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((g) => (
              <li key={g.id} className="border border-line bg-surface p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Thumb url={g.sourceUrl} alt="Sursa" empty="fără foto" />
                  <Thumb url={g.resultUrl} alt="Rezultat" empty="—" />
                </div>
                <p className="mt-3 line-clamp-3 text-sm">{g.prompt}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {g.style && isStyle(g.style) ? STYLE_LABEL.ro[g.style] : g.style} · {dateFmt(g.created_at)}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {g.owner_kind === "telegram" ? "Telegram" : "Admin"} · {g.owner_label}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Figure({ title, url, empty, children }: { title: string; url: string | null; empty: string; children?: React.ReactNode }) {
  return (
    <figure className="border border-line bg-surface p-4">
      <figcaption className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{title}</figcaption>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase link or local blob
        <img src={url} alt={title} className="mt-3 w-full border border-line" />
      ) : (
        <div className="mt-3 grid aspect-[4/3] place-items-center border border-dashed border-line text-sm text-muted">
          {empty}
        </div>
      )}
      {children}
    </figure>
  );
}

function Thumb({ url, alt, empty }: { url: string | null; alt: string; empty: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase link */}
      <img src={url} alt={alt} className="aspect-[4/3] w-full border border-line object-cover" />
    </a>
  ) : (
    <div className="grid aspect-[4/3] place-items-center border border-dashed border-line font-mono text-[10px] uppercase text-muted">
      {empty}
    </div>
  );
}
