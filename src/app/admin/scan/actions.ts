"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EXT,
  MAX_DOCUMENT_BYTES,
  recognizeBusinessCard,
  sniffType,
  type CardFields,
  type DocumentType,
} from "@/lib/business-card";
import { validateLead, type LeadErrors } from "@/lib/lead";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

const BUCKET = "documents";

async function isAdmin() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

async function readDocument(form: FormData): Promise<{ bytes: Uint8Array; type: DocumentType } | string> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return "Alegeți o fotografie sau un PDF.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Fișierul e prea mare (max. 4 MB).";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return "Format neacceptat. Încărcați o fotografie JPG, PNG, WEBP sau un PDF.";
  return { bytes, type };
}

export type RecognizeState = { fields?: CardFields; error?: string };

// Step 1: recognize only. Nothing is stored here, so a rejected upload leaves no trace.
export async function recognizeCard(form: FormData): Promise<RecognizeState> {
  if (!(await isAdmin())) return { error: "Sesiunea a expirat. Intrați din nou." };

  const doc = await readDocument(form);
  if (typeof doc === "string") return { error: doc };

  const res = await recognizeBusinessCard(doc.bytes, doc.type);
  if (res.ok) return { fields: res.fields };
  return {
    error: {
      not_card:
        "Pe acest fișier nu am găsit o carte de vizită. Fotografiați cartea de aproape, clar și bine luminată. Nu s-a salvat nimic.",
      refused: "Documentul nu a putut fi procesat. Nu s-a salvat nimic.",
      no_key: "Recunoașterea nu este configurată (lipsește ANTHROPIC_API_KEY).",
      failed: "Recunoașterea a eșuat. Încercați din nou peste câteva secunde.",
    }[res.reason],
  };
}

const FIELDS = ["name", "phone", "email", "company", "job_title", "website", "address", "notes"] as const;
export type SaveState = { errors?: LeadErrors & { form?: string } };

// Step 2: after the admin checked the fields, store the original and create the lead.
export async function saveCard(form: FormData): Promise<SaveState> {
  if (!(await isAdmin())) return { errors: { form: "Sesiunea a expirat. Intrați din nou." } };

  const v = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "").trim()])) as Record<
    (typeof FIELDS)[number],
    string
  >;
  const { lead, errors } = validateLead({ kind: "quote", name: v.name, phone: v.phone, email: v.email });
  if (Object.keys(errors).length > 0) return { errors };
  if (Object.values(v).some((s) => s.length > 2000)) return { errors: { form: "Un câmp este prea lung." } };

  const doc = await readDocument(form);
  if (typeof doc === "string") return { errors: { form: doc } };

  const comment = [
    v.company && `Companie: ${v.company}`,
    v.job_title && `Funcție: ${v.job_title}`,
    v.website && `Website: ${v.website}`,
    v.address && `Adresă: ${v.address}`,
  ]
    .filter(Boolean)
    .join("\n");

  const db = supabaseAdmin();
  const path = `business-cards/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT[doc.type]}`;

  const upload = await db.storage.from(BUCKET).upload(path, doc.bytes, { contentType: doc.type });
  if (upload.error) {
    console.error("[ocr] upload failed:", upload.error.message);
    return { errors: { form: "Nu am putut salva originalul. Încercați din nou." } };
  }

  // Stage 'new' and the first history row come from the table default and trigger.
  const { data, error } = await db
    .from("leads")
    .insert({
      source: "business_card",
      kind: null,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || null,
      project_type: null,
      comment: comment || null,
      notes: v.notes || null,
      document_path: path,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("[ocr] lead insert failed:", error?.message);
    await db.storage.from(BUCKET).remove([path]);
    return { errors: { form: "Nu am putut salva clientul. Încercați din nou." } };
  }

  revalidatePath("/admin");
  redirect(`/admin/leads/${data.id}`);
}
