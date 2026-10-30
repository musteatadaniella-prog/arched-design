"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateLead, type LeadErrors } from "@/lib/lead";
import { supabaseServer } from "@/lib/supabase-server";
import { STATUSES, type LeadStatus } from "./statuses";

export type LoginState = { error?: string; email?: string };

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Completați emailul și parola.", email };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email sau parolă greșită.", email };

  redirect("/admin");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// Signed-in client or null. RLS and column grants enforce the same rules on the
// database side; this check just gives a clean failure instead of a DB error.
async function adminClient() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function updateStatus(id: string, status: LeadStatus) {
  if (!STATUSES.includes(status)) return { ok: false };

  const supabase = await adminClient();
  if (!supabase) return { ok: false };

  // The stage history row is written by a database trigger.
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) {
    console.error("[admin] status update failed:", error.message);
    return { ok: false };
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export type NotesState = { ok?: boolean; error?: string };

export async function saveNotes(id: string, _prev: NotesState, form: FormData): Promise<NotesState> {
  const notes = String(form.get("notes") ?? "").trim();
  if (notes.length > 5000) return { error: "Notițele sunt prea lungi (max. 5000 de caractere)." };

  const supabase = await adminClient();
  if (!supabase) return { error: "Sesiunea a expirat. Intrați din nou." };

  const { error } = await supabase
    .from("leads")
    .update({ notes: notes || null })
    .eq("id", id);
  if (error) {
    console.error("[admin] notes update failed:", error.message);
    return { error: "Nu am putut salva notițele." };
  }
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true };
}

const FIELDS = ["name", "phone", "email", "projectType", "comment", "notes"] as const;
export type NewLeadState = {
  errors?: LeadErrors & { form?: string };
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
};

export async function createLead(_prev: NewLeadState, form: FormData): Promise<NewLeadState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "").trim()])) as Record<
    (typeof FIELDS)[number],
    string
  >;
  const { lead, errors } = validateLead({ ...values, kind: "quote" });
  if (Object.keys(errors).length > 0) return { errors, values };
  if (values.notes.length > 5000) return { errors: { form: "Notițele sunt prea lungi." }, values };

  const supabase = await adminClient();
  if (!supabase) return { errors: { form: "Sesiunea a expirat. Intrați din nou." }, values };

  const { data, error } = await supabase
    .from("leads")
    .insert({
      source: "manual",
      name: lead.name,
      phone: lead.phone,
      email: lead.email || null,
      project_type: lead.projectType || null,
      comment: lead.comment || null,
      notes: values.notes || null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("[admin] manual lead insert failed:", error?.message);
    return { errors: { form: "Nu am putut salva clientul. Încercați din nou." }, values };
  }

  revalidatePath("/admin");
  redirect(`/admin/leads/${data.id}`);
}
