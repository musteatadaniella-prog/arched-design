"use client";

import { useCallback, useEffect, useState } from "react";
import { STYLES, STYLE_LABEL, resetTime, type Style } from "@/lib/design-styles";
import type { Generation, Quota } from "@/lib/generations";
import { shrinkImage } from "@/lib/shrink-image";

// Design visualization for clients: a photo of their room plus wishes, drawn
// by GPT Image on our server. Requests go to /api/tg/generate only.

type Api = (path: string, init?: RequestInit) => Promise<Response>;

const MAX_BYTES = 4 * 1024 * 1024;
const red = "text-[#b4533f]";

const copy = {
  ro: {
    title: "Vizualizează-ți spațiul",
    lead: "Fotografiați camera sau fațada și scrieți ce ați dori. Vă arătăm o schiță în mai puțin de un minut.",
    photo: "Fotografiază spațiul",
    another: "Altă fotografie",
    noPhoto: "Fără foto",
    wishes: "Ce ați dori?",
    placeholder: "Bucătărie albă cu blat din lemn, insulă, lumină caldă",
    style: "Stil",
    left: (q: Quota) => `Rămase: ${q.left} din ${q.limit} în 24 de ore`,
    go: "Generează schița",
    going: "Se generează… (până la un minut)",
    source: "Fotografia dvs.",
    result: "Schița",
    history: "Schițele mele",
    none: "Încă nu ați generat nicio schiță.",
    short: "Descrieți ce doriți să vedeți.",
    badPhoto: "Nu pot deschide această imagine. Încercați altă fotografie.",
    limit: (q: Quota) =>
      `Ați folosit toate cele ${q.limit} generări pentru 24 de ore.` +
      (q.resetAt ? ` Următoarea va fi disponibilă pe ${resetTime(q.resetAt, "ro")}.` : ""),
    errors: {
      prompt: "Descrieți dorințele în 3–1000 de caractere.",
      photo: "Fotografia nu poate fi folosită. Încercați alta.",
      blocked: "Nu am putut genera această imagine. Reformulați descrierea sau folosiți altă fotografie.",
      busy: "Serviciul este ocupat. Încercați din nou peste un minut.",
      failed: "Generarea a eșuat. Încercați din nou.",
    },
    loadFailed: "Nu am putut încărca schițele.",
  },
  en: {
    title: "Visualize your space",
    lead: "Take a photo of the room or facade and write what you would like. We show you a sketch in under a minute.",
    photo: "Photograph the space",
    another: "Another photo",
    noPhoto: "No photo",
    wishes: "What would you like?",
    placeholder: "White kitchen with a wooden worktop, an island, warm light",
    style: "Style",
    left: (q: Quota) => `Left: ${q.left} of ${q.limit} per 24 hours`,
    go: "Generate sketch",
    going: "Generating… (up to a minute)",
    source: "Your photo",
    result: "Sketch",
    history: "My sketches",
    none: "You have not generated any sketches yet.",
    short: "Describe what you would like to see.",
    badPhoto: "This image cannot be opened. Try another photo.",
    limit: (q: Quota) =>
      `You have used all ${q.limit} generations for 24 hours.` +
      (q.resetAt ? ` The next one is available on ${resetTime(q.resetAt, "en")}.` : ""),
    errors: {
      prompt: "Describe your wishes in 3–1000 characters.",
      photo: "This photo cannot be used. Try another one.",
      blocked: "We could not generate this image. Rephrase the description or use another photo.",
      busy: "The service is busy. Try again in a minute.",
      failed: "Generation failed. Please try again.",
    },
    loadFailed: "We could not load your sketches.",
  },
} as const;

type ErrorCode = keyof (typeof copy)["ro"]["errors"];

export function DesignView({ api, haptic, lang }: { api: Api; haptic: (ok: boolean) => void; lang: "ro" | "en" }) {
  const c = copy[lang];
  const [items, setItems] = useState<Generation[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<Style>("modern");
  const [result, setResult] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const res = await api("/api/tg/generate");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error("load");
    setItems(data.items);
    setQuota(data.quota);
  }, [api]);

  useEffect(() => {
    load().catch(() => setError(c.loadFailed));
  }, [load, c.loadFailed]);

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
      setError(c.badPhoto);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (prompt.trim().length < 3) return setError(c.short);
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("style", style);
    if (photo) form.set("photo", photo);

    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await api("/api/tg/generate", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (data?.quota) setQuota(data.quota);
      if (res.ok && data?.ok) {
        setResult(data.item);
        setItems((list) => [data.item, ...list]);
        haptic(true);
      } else {
        haptic(false);
        setError(
          data?.code === "limit" && data.quota ? c.limit(data.quota) : (c.errors[data?.code as ErrorCode] ?? c.errors.failed),
        );
      }
    } catch {
      haptic(false);
      setError(c.errors.failed);
    } finally {
      setPending(false);
    }
  }

  const shown = result?.sourceUrl ?? preview;

  return (
    <>
      <h2 className="mt-8 font-display text-2xl uppercase">{c.title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.lead}</p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer border border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.15em]">
            {photo ? c.another : c.photo}
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
            <button type="button" onClick={() => void onPick(undefined)} className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              {c.noPhoto}
            </button>
          )}
        </div>

        {shown && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={shown} alt={c.source} className="w-full border border-line" />
        )}

        <label className="grid gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{c.wishes}</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={c.placeholder}
            className="w-full border border-line bg-white px-3 py-3 text-base outline-none focus:border-ink"
          />
        </label>

        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{c.style}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={style === s}
                onClick={() => setStyle(s)}
                className={`border px-3 py-2 text-sm ${style === s ? "border-ink bg-ink text-surface" : "border-line bg-bg/40"}`}
              >
                {STYLE_LABEL[lang][s]}
              </button>
            ))}
          </div>
        </div>

        {quota && <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">{c.left(quota)}</p>}

        {error && (
          <p role="alert" className={`border border-[#b4533f]/40 bg-[#b4533f]/5 p-3 text-sm ${red}`}>
            {error}
          </p>
        )}

        <button
          disabled={pending}
          className="w-full bg-ink px-5 py-4 font-mono text-xs uppercase tracking-[0.15em] text-surface disabled:opacity-60"
        >
          {pending ? c.going : c.go}
        </button>
      </form>

      {result?.resultUrl && (
        <figure className="mt-5 border border-ink bg-surface p-3">
          <figcaption className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{c.result}</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase link */}
          <img src={result.resultUrl} alt={c.result} className="mt-2 w-full border border-line" />
        </figure>
      )}

      <section className="mt-8">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{c.history}</h3>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{c.none}</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {items.map((g) => (
              <li key={g.id} className="border border-line bg-surface p-3">
                <div className={`grid gap-2 ${g.sourceUrl ? "grid-cols-2" : "grid-cols-1"}`}>
                  {[g.sourceUrl, g.resultUrl].filter(Boolean).map((u) => (
                    <a key={u} href={u!} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase link */}
                      <img src={u!} alt="" className="aspect-[4/3] w-full border border-line object-cover" />
                    </a>
                  ))}
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{g.prompt}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">
                  {new Date(g.created_at).toLocaleString(lang === "en" ? "en-GB" : "ro-RO")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
