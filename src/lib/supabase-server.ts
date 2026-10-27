import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Per-request Supabase client acting as the signed-in admin. It uses the
// publishable key plus the session cookies, so Row Level Security applies:
// without a valid session it can read nothing.

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set");
  return { url, key };
}

export async function supabaseServer() {
  const { url, key } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        // Server components cannot write cookies; the middleware refreshes them.
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}
