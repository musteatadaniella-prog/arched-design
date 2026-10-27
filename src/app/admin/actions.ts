"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function updateStatus(id: string, status: LeadStatus) {
  if (!STATUSES.includes(status)) return { ok: false };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // RLS and the column grant also enforce this on the database side.
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) {
    console.error("[admin] status update failed:", error.message);
    return { ok: false };
  }
  revalidatePath("/admin");
  return { ok: true };
}
