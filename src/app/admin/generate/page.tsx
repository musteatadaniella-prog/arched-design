import { redirect } from "next/navigation";
import { history, quotaFor } from "@/lib/generations";
import { supabaseServer } from "@/lib/supabase-server";
import { AdminHeader } from "../AdminHeader";
import { GenerateForm } from "./GenerateForm";

export const dynamic = "force-dynamic";
// GPT Image takes 20–60 seconds per picture; the server action runs here.
export const maxDuration = 120;

export default async function GeneratePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const owner = { kind: "admin" as const, id: user.id, label: user.email ?? "Admin" };
  const [items, quota] = await Promise.all([history("all", 40), quotaFor(owner)]).catch((e) => {
    console.error("[image] load failed:", e instanceof Error ? e.message : e);
    return [null, null] as const;
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <AdminHeader title="Vizualizare proiect" email={user.email} />

      {items && quota ? (
        <GenerateForm initialItems={items} initialQuota={quota} />
      ) : (
        <p role="alert" className="mt-8 text-sm text-[#b4533f]">
          Nu am putut încărca istoricul generărilor. Verificați că supabase/generations.sql a fost rulat.
        </p>
      )}
    </main>
  );
}
