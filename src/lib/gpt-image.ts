import "server-only";
import { sniffType } from "@/lib/business-card";
import type { Style } from "@/lib/design-styles";

// Draws a design visualization with GPT Image 2.5 (OpenAI Images API).
// Runs only on the server: the key lives in OPENAI_API_KEY and the browser
// talks to our own routes, never to OpenAI.

export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";

const API = "https://api.openai.com/v1/images";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

const STYLE_PROMPT: Record<Style, string> = {
  modern: "contemporary modern",
  minimal: "minimalist, calm and uncluttered",
  scandi: "Scandinavian, light wood and soft textiles",
  loft: "industrial loft, concrete, metal and brick",
  classic: "modern classic, mouldings and warm tones",
};

export type DrawResult =
  | { ok: true; bytes: Uint8Array; type: ImageType }
  | { ok: false; reason: "no_key" | "blocked" | "busy" | "failed" };

function buildPrompt(wishes: string, style: Style, withPhoto: boolean) {
  return [
    "You are the visualizer of ARCHED design, an architecture and interior design studio.",
    withPhoto
      ? "Redesign the space in the attached photo. Keep its walls, windows, doors, ceiling height and camera angle; change finishes, furniture, lighting and decor."
      : "Create a visualization of the space the client describes, seen from a natural eye-level camera.",
    `Style: ${STYLE_PROMPT[style]}.`,
    `Client wishes (may be in any language): ${wishes}`,
    "Output one photorealistic interior or architecture render. No text, labels, logos or watermarks in the image.",
  ].join("\n");
}

export async function drawDesign(
  wishes: string,
  style: Style,
  photo: { bytes: Uint8Array; type: ImageType } | null,
): Promise<DrawResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("[image] OPENAI_API_KEY is not set");
    return { ok: false, reason: "no_key" };
  }

  const prompt = buildPrompt(wishes, style, Boolean(photo));
  const common = { model: IMAGE_MODEL, prompt, quality: QUALITY, output_format: "jpeg", output_compression: "85" };

  let init: RequestInit;
  if (photo) {
    // With a photo the result keeps its proportions ("auto" size).
    const form = new FormData();
    Object.entries({ ...common, size: "auto" }).forEach(([k, v]) => form.set(k, v));
    form.append("image[]", new Blob([Buffer.from(photo.bytes)],{ type: photo.type }), `space.${photo.type.split("/")[1]}`);
    init = { body: form };
  } else {
    init = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...common, size: "1536x1024", output_compression: 85 }),
    };
  }

  try {
    const res = await fetch(`${API}/${photo ? "edits" : "generations"}`, {
      ...init,
      method: "POST",
      headers: { ...init.headers, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(110_000),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const err = json?.error;
      console.error("[image] OpenAI API error:", res.status, err?.code, err?.message?.slice(0, 300));
      if (err?.code === "moderation_blocked") return { ok: false, reason: "blocked" };
      if (res.status === 429 || res.status >= 500) return { ok: false, reason: "busy" };
      return { ok: false, reason: res.status === 401 || res.status === 403 ? "no_key" : "failed" };
    }

    const data: string | undefined = json?.data?.[0]?.b64_json;
    if (!data) {
      console.error("[image] no image in response");
      return { ok: false, reason: "failed" };
    }

    const bytes = new Uint8Array(Buffer.from(data, "base64"));
    const type = sniffType(bytes);
    if (!type || type === "application/pdf") return { ok: false, reason: "failed" };
    return { ok: true, bytes, type };
  } catch (e) {
    console.error("[image] generation failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "failed" };
  }
}
