import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Guards /admin: refreshes the Supabase session cookies and sends anyone
// without a valid session to the login page.

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new NextResponse("Admin is not configured", { status: 503 });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => res.headers.set(k, v));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = req.nextUrl.pathname === "/admin/login";
  if (!user && !isLogin) return NextResponse.redirect(new URL("/admin/login", req.url));
  if (user && isLogin) return NextResponse.redirect(new URL("/admin", req.url));

  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
