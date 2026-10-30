"use server";

import { revalidatePath } from "next/cache";
import { isStyle } from "@/lib/design-styles";
import { generate, type Generation, type Quota } from "@/lib/generations";
import { supabaseServer } from "@/lib/supabase-server";

export type GenerateState = { generation?: Generation; quota?: Quota; error?: string };

const MESSAGE = {
  prompt: "Descrieți dorințele în 3–1000 de caractere.",
  photo: "Fotografia nu poate fi folosită. Încărcați un JPG, PNG sau WEBP de până la 4 MB.",
  no_key: "Generarea nu este configurată (lipsește OPENAI_API_KEY).",
  blocked: "Cererea a fost refuzată de filtrul de siguranță. Reformulați descrierea sau folosiți altă fotografie.",
  busy: "Serviciul de generare este ocupat. Încercați din nou peste un minut.",
  failed: "Generarea a eșuat. Încercați din nou.",
};

export async function generateDesign(form: FormData): Promise<GenerateState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesiunea a expirat. Intrați din nou." };

  const style = form.get("style");
  const photo = form.get("photo");
  const res = await generate(
    { kind: "admin", id: user.id, label: user.email ?? "Admin" },
    {
      prompt: String(form.get("prompt") ?? ""),
      style: isStyle(style) ? style : "modern",
      photo: photo instanceof File ? photo : null,
    },
  );

  if (res.ok) {
    revalidatePath("/admin/generate");
    return { generation: res.generation, quota: res.quota };
  }
  // The limit message is built on the page, in the admin's local time.
  if (res.error.code === "limit") return { quota: res.error.quota, error: "limit" };
  return { error: MESSAGE[res.error.code] };
}
