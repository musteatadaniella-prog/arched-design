"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { CardFields } from "@/lib/business-card";
import type { LeadErrorKey } from "@/lib/lead";
import { shrinkImage } from "@/lib/shrink-image";
import { recognizeCard, saveCard, type SaveState } from "./actions";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 1600;

const inputCls =
  "w-full border-b border-line bg-transparent py-2.5 outline-none transition-colors placeholder:text-muted focus:border-ink";

const MESSAGE: Partial<Record<LeadErrorKey, string>> = {
  required: "Câmp obligatoriu.",
  name: "Numele trebuie să aibă 2–100 de caractere.",
  phone: "Număr de telefon invalid.",
  email: "Email invalid.",
};

const LABELS: { key: keyof CardFields; label: string; type?: string }[] = [
  { key: "name", label: "Nume *" },
  { key: "phone", label: "Telefon *", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "company", label: "Companie" },
  { key: "job_title", label: "Funcție" },
  { key: "website", label: "Website" },
  { key: "address", label: "Adresă" },
];

// Phone photos are shrunk in the browser: smaller upload, same text for Claude.
const prepare = (file: File) =>
  file.type === "application/pdf" ? Promise.resolve(file) : shrinkImage(file, MAX_SIDE, "card.jpg");

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fields, setFields] = useState<CardFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<SaveState["errors"]>({});
  const [recognizing, startRecognize] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    setFields(null);
    setError(null);
    setSaveErrors({});
  }

  async function onPick(picked: File | undefined) {
    reset();
    if (!picked) return;
    let ready: File;
    try {
      ready = await prepare(picked);
    } catch {
      setError("Nu pot deschide această imagine. Folosiți JPG, PNG sau PDF.");
      return;
    }
    if (ready.size > MAX_BYTES) {
      setError("Fișierul e prea mare (max. 4 MB).");
      return;
    }
    setFile(ready);
    setPreview(URL.createObjectURL(ready));

    const form = new FormData();
    form.set("file", ready);
    startRecognize(async () => {
      const res = await recognizeCard(form);
      if (res.fields) setFields(res.fields);
      else setError(res.error ?? "Recunoașterea a eșuat.");
    });
  }

  function onSave(form: FormData) {
    if (!file) return;
    form.set("file", file);
    setSaveErrors({});
    startSave(async () => {
      // On success the action redirects to the new client card.
      const res = await saveCard(form);
      if (res?.errors) setSaveErrors(res.errors);
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <Link href="/admin" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft hover:text-ink">
        ← Pâlnie
      </Link>

      <section className="mt-4 border border-line bg-surface p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Sursa: Carte de vizită</p>
        <h1 className="mt-1 font-display text-3xl uppercase">Scanează carte de vizită</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Fotografiați cartea sau încărcați un PDF. Claude citește datele, iar dumneavoastră le verificați înainte de
          salvare.
        </p>

        <label className="mt-6 inline-block cursor-pointer bg-ink px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-surface transition-opacity hover:opacity-85">
          {file ? "Alt fișier" : "Alege foto / PDF"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={recognizing || saving}
            onChange={(e) => {
              void onPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        {recognizing && (
          <p role="status" className="mt-5 text-sm text-ink-soft">
            Se recunoaște cartea de vizită…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 border border-[#b4533f]/40 bg-[#b4533f]/5 p-4 text-sm text-[#b4533f]">
            {error}
          </p>
        )}
      </section>

      {preview && (fields || recognizing) && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="border border-line bg-surface p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Original</h2>
            {file?.type === "application/pdf" ? (
              <object data={preview} type="application/pdf" className="mt-3 h-[420px] w-full">
                <a href={preview} target="_blank" rel="noreferrer" className="text-sm underline">
                  Deschide PDF-ul
                </a>
              </object>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={preview} alt="Cartea de vizită încărcată" className="mt-3 w-full border border-line" />
            )}
          </section>

          {fields && (
            <form action={onSave} className="border border-line bg-surface p-5 sm:p-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
                Verificați datele recunoscute
              </h2>
              {LABELS.map((f) => {
                const err = saveErrors?.[f.key as "name" | "phone" | "email"];
                return (
                  <label key={f.key} className="mt-4 block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{f.label}</span>
                    <input
                      name={f.key}
                      type={f.type ?? "text"}
                      defaultValue={fields[f.key]}
                      aria-invalid={err ? true : undefined}
                      className={inputCls}
                    />
                    {err && <span className="mt-1 block text-xs text-[#b4533f]">{MESSAGE[err] ?? "Invalid."}</span>}
                  </label>
                );
              })}
              <label className="mt-4 block">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Notițe</span>
                <textarea name="notes" rows={3} defaultValue={fields.notes} className={`${inputCls} resize-y`} />
              </label>

              {saveErrors?.form && (
                <p role="alert" className="mt-4 text-sm text-[#b4533f]">
                  {saveErrors.form}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  disabled={saving}
                  className="bg-ink px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-surface transition-opacity disabled:opacity-60"
                >
                  {saving ? "Se salvează…" : "Salvează în pâlnie"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={saving}
                  className="border border-line px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] hover:border-ink"
                >
                  Anulează
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
