import { NextResponse } from "next/server";
import { invoicePdfUrl } from "@/lib/invoices";
import { supabaseServer } from "@/lib/supabase-server";

// Opens an invoice PDF from the client card. The bucket is private, so each
// click gets a fresh link that expires after a minute. The PDF is drawn the
// first time it is opened if it was not drawn yet.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  try {
    const url = await invoicePdfUrl(Number(id));
    if (!url) return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[invoice] pdf failed:", e instanceof Error ? e.message : e);
    return new NextResponse("PDF unavailable", { status: 502 });
  }
}
