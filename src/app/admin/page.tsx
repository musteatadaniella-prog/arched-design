import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { AdminHeader } from "./AdminHeader";
import { Board, type BoardCard } from "./Board";

export const dynamic = "force-dynamic";

type Row = Omit<BoardCard, "contract_amount" | "paid"> & {
  contract_amount: number | string | null;
  lead_payments: { amount: number | string }[] | null;
};

export default async function AdminPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, status, source, name, phone, project_type, contract_amount, contract_currency, lead_payments(amount)",
    )
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Row[]>();

  const cards: BoardCard[] = (leads ?? []).map(({ lead_payments, contract_amount, ...c }) => ({
    ...c,
    contract_amount: contract_amount != null ? Number(contract_amount) : null,
    paid: (lead_payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <AdminHeader title="Pâlnie de vânzări" email={user.email} />

      {error ? (
        <p role="alert" className="mt-8 text-sm text-[#b4533f]">
          Nu am putut încărca clienții. Încercați din nou.
        </p>
      ) : (
        <Board leads={cards} />
      )}
    </main>
  );
}
