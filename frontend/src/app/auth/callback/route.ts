import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../../lib/supabase/config";

function sanitizeRedirectPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith("/")) {
    return "/";
  }
  return candidate;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  // Default redirect path (the LoginPage will redirect further if needed).
  const redirectResponse = NextResponse.redirect(new URL("/login", requestUrl.origin));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback_failed", requestUrl.origin));
  }

  return redirectResponse;
}
