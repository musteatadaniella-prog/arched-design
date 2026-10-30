import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

// Opens a client's original document. The bucket is private, so each click
// gets a fresh link that expires after a minute.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const { data: lead } = await supabase
    .from("leads")
    .select("document_path")
    .eq("id", id)
    .maybeSingle<{ document_path: string | null }>();
  if (!lead?.document_path) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabaseAdmin().storage.from("documents").createSignedUrl(lead.document_path, 60);
  if (error || !data) {
    console.error("[ocr] signed url failed:", error?.message);
    return new NextResponse("Document unavailable", { status: 502 });
  }
  return NextResponse.redirect(data.signedUrl);
}
