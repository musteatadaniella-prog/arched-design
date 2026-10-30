import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Reads a business card (photo or PDF) with Claude and returns its fields.
// Runs only on the server: the API key lives in ANTHROPIC_API_KEY.

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB

export type DocumentType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export const EXT: Record<DocumentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Trust the file's first bytes, not the name or the type the browser reports.
export function sniffType(bytes: Uint8Array): DocumentType | null {
  const at = (i: number, ...b: number[]) => b.every((v, k) => bytes[i + k] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}

const CardSchema = z.object({
  is_business_card: z.boolean(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  company: z.string(),
  job_title: z.string(),
  website: z.string(),
  address: z.string(),
  notes: z.string(),
});

export type CardFields = Omit<z.infer<typeof CardSchema>, "is_business_card">;

export type RecognizeResult =
  | { ok: true; fields: CardFields }
  | { ok: false; reason: "not_card" | "refused" | "no_key" | "failed" };

const PROMPT = `You receive a photo or PDF that should show a business card.

If it is not a business card (or no card text is readable), set is_business_card to false and leave every other field as an empty string.

Otherwise set is_business_card to true and copy the details exactly as printed:
- name: the person's full name (if only a company is shown, use the company name)
- phone: the main phone number, keeping the country code if printed
- email, company, job_title, website, address
- notes: any other useful printed text (extra phones, social handles, services), one item per line
Use an empty string for anything not on the card. Do not invent or translate values.`;

let client: Anthropic | null = null;

export async function recognizeBusinessCard(bytes: Uint8Array, type: DocumentType): Promise<RecognizeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[ocr] ANTHROPIC_API_KEY is not set");
    return { ok: false, reason: "no_key" };
  }
  client ??= new Anthropic();

  const data = Buffer.from(bytes).toString("base64");
  const file: Anthropic.Beta.BetaContentBlockParam =
    type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: type, data } };

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(CardSchema) },
      messages: [{ role: "user", content: [file, { type: "text", text: PROMPT }] }],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const card = response.parsed_output;
    if (!card) return { ok: false, reason: "failed" };
    if (!card.is_business_card) return { ok: false, reason: "not_card" };

    return {
      ok: true,
      fields: {
        name: card.name,
        phone: card.phone,
        email: card.email,
        company: card.company,
        job_title: card.job_title,
        website: card.website,
        address: card.address,
        notes: card.notes,
      },
    };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error("[ocr] Claude API error:", e.status, e.message);
    else console.error("[ocr] recognition failed:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "failed" };
  }
}
