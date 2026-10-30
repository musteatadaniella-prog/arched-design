import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { AdminHeader } from "./AdminHeader";
import { Board, type BoardCard } from "./Board";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, created_at, status, source, name, phone, project_type")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<BoardCard[]>();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <AdminHeader title="Pâlnie de vânzări" email={user.email} />

      {error ? (
        <p role="alert" className="mt-8 text-sm text-[#b4533f]">
          Nu am putut încărca clienții. Încercați din nou.
        </p>
      ) : (
        <Board leads={leads ?? []} />
      )}
    </main>
  );
}
