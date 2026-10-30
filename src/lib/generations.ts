import "server-only";
import { EXT, sniffType } from "@/lib/business-card";
import type { Style } from "@/lib/design-styles";
import { IMAGE_MODEL, drawDesign, type ImageType } from "@/lib/gpt-image";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Generation history and the per-user daily limit, shared by /admin/generate
// and the Telegram Mini App.

const BUCKET = "generations";
export const DAILY_LIMIT = Math.max(1, Number(process.env.GENERATION_DAILY_LIMIT) || 5);
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
const DAY_MS = 24 * 60 * 60 * 1000;
// A request that died mid-generation stops holding a slot after this long.
const PENDING_MS = 5 * 60 * 1000;

export type Owner = { kind: "admin" | "telegram"; id: string; label: string };

export type Quota = { limit: number; used: number; left: number; resetAt: string | null };

export type Generation = {
  id: string;
  created_at: string;
  owner_kind: Owner["kind"];
  owner_label: string | null;
  prompt: string;
  style: string | null;
  sourceUrl: string | null;
  resultUrl: string | null;
};

export type GenerateError =
  | { code: "limit"; quota: Quota }
  | { code: "prompt" | "photo" | "no_key" | "rejected" | "blocked" | "busy" | "failed"; detail?: string };


// Rows that use up the limit: finished ones, plus ones being drawn right now.
async function countedRows(owner: Owner) {
  const now = Date.now();
  const { data, error } = await supabaseAdmin()
    .from("image_generations")
    .select("id, created_at")
    .eq("owner_kind", owner.kind)
    .eq("owner_id", owner.id)
    .gt("created_at", new Date(now - DAY_MS).toISOString())
    .or(`status.eq.done,created_at.gt."${new Date(now - PENDING_MS).toISOString()}"`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as { id: string; created_at: string }[];
}

function toQuota(rows: { created_at: string }[]): Quota {
  const used = Math.min(rows.length, DAILY_LIMIT);
  // A slot frees up 24 hours after the oldest generation in the window.
  const resetAt =
    rows.length >= DAILY_LIMIT ? new Date(new Date(rows[0].created_at).getTime() + DAY_MS).toISOString() : null;
  return { limit: DAILY_LIMIT, used, left: DAILY_LIMIT - used, resetAt };
}

export async function quotaFor(owner: Owner): Promise<Quota> {
  return toQuota(await countedRows(owner));
}

export async function generate(
  owner: Owner,
  input: { prompt: string; style: Style; photo: File | null },
): Promise<{ ok: true; generation: Generation; quota: Quota } | { ok: false; error: GenerateError }> {
  const prompt = input.prompt.trim();
  if (prompt.length < 3 || prompt.length > 1000) return { ok: false, error: { code: "prompt" } };

  let photo: { bytes: Uint8Array; type: ImageType } | null = null;
  if (input.photo && input.photo.size > 0) {
    if (input.photo.size > MAX_PHOTO_BYTES) return { ok: false, error: { code: "photo" } };
    const bytes = new Uint8Array(await input.photo.arrayBuffer());
    const type = sniffType(bytes);
    if (!type || type === "application/pdf") return { ok: false, error: { code: "photo" } };
    photo = { bytes, type };
  }

  const db = supabaseAdmin();

  // Take a slot first, then count: two requests sent at once cannot both
  // squeeze past the limit.
  const { data: row, error: insertError } = await db
    .from("image_generations")
    .insert({
      owner_kind: owner.kind,
      owner_id: owner.id,
      owner_label: owner.label,
      prompt,
      style: input.style,
      model: IMAGE_MODEL,
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();
  if (insertError || !row) {
    console.error("[image] insert failed:", insertError?.message);
    return { ok: false, error: { code: "failed" } };
  }

  const drop = async (paths: string[] = []) => {
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    await db.from("image_generations").delete().eq("id", row.id);
  };

  const rows = await countedRows(owner).catch(() => null);
  if (!rows) {
    await drop();
    return { ok: false, error: { code: "failed" } };
  }
  const mine = rows.findIndex((r) => r.id === row.id);
  if (mine >= DAILY_LIMIT) {
    await drop();
    return { ok: false, error: { code: "limit", quota: toQuota(rows.filter((r) => r.id !== row.id)) } };
  }

  const drawn = await drawDesign(prompt, input.style, photo);
  if (!drawn.ok) {
    await drop();
    return { ok: false, error: { code: drawn.reason, detail: drawn.detail } };
  }

  const dir = `${owner.kind}/${owner.id}/${row.created_at.slice(0, 7)}`;
  const sourcePath = photo ? `${dir}/${row.id}-source.${EXT[photo.type]}` : null;
  const resultPath = `${dir}/${row.id}-result.${EXT[drawn.type]}`;

  const uploads = await Promise.all([
    db.storage.from(BUCKET).upload(resultPath, drawn.bytes, { contentType: drawn.type }),
    photo && sourcePath ? db.storage.from(BUCKET).upload(sourcePath, photo.bytes, { contentType: photo.type }) : null,
  ]);
  const uploadError = uploads.find((u) => u?.error)?.error;
  const { error: updateError } = uploadError
    ? { error: uploadError }
    : await db
        .from("image_generations")
        .update({ status: "done", source_path: sourcePath, result_path: resultPath })
        .eq("id", row.id);
  if (updateError) {
    console.error("[image] save failed:", updateError.message);
    await drop([resultPath, ...(sourcePath ? [sourcePath] : [])]);
    return { ok: false, error: { code: "failed" } };
  }

  const [generation] = await withUrls([
    {
      id: row.id,
      created_at: row.created_at,
      owner_kind: owner.kind,
      owner_label: owner.label,
      prompt,
      style: input.style,
      source_path: sourcePath,
      result_path: resultPath,
    },
  ]);
  return { ok: true, generation, quota: await quotaFor(owner) };
}

type Row = Omit<Generation, "sourceUrl" | "resultUrl"> & { source_path: string | null; result_path: string | null };

// The bucket is private: pictures are shown through links valid for an hour.
async function withUrls(rows: Row[]): Promise<Generation[]> {
  const paths = rows.flatMap((r) => [r.source_path, r.result_path]).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    if (error) console.error("[image] signed urls failed:", error.message);
    data?.forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
  }
  return rows.map(({ source_path, result_path, ...r }) => ({
    ...r,
    sourceUrl: source_path ? (urls.get(source_path) ?? null) : null,
    resultUrl: result_path ? (urls.get(result_path) ?? null) : null,
  }));
}

// Finished generations, newest first: one owner's, or everyone's for admins.
export async function history(owner: Owner | "all", limit = 30): Promise<Generation[]> {
  let q = supabaseAdmin()
    .from("image_generations")
    .select("id, created_at, owner_kind, owner_label, prompt, style, source_path, result_path")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (owner !== "all") q = q.eq("owner_kind", owner.kind).eq("owner_id", owner.id);
  const { data, error } = await q;
  if (error) throw error;
  return withUrls(data as Row[]);
}
