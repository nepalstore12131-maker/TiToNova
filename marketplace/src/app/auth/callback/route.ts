import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeInternalPath(candidate: string | null) {
  const fallback = "/dashboard";
  if (!candidate) return fallback;
  const localOrigin = "https://titonova.invalid";
  try {
    const target = new URL(candidate, localOrigin);
    const isAuthRoute = /^\/(?:login|employer\/login|admin\/login|signup|forgot-password|reset-password|auth\/callback)(?:\/|$)/.test(target.pathname);
    if (target.origin !== localOrigin || isAuthRoute) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safeNext = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation`);
}
