import { NextResponse, type NextRequest } from "next/server";
import { canonicalSiteUrl } from "@/lib/auth-navigation";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const canonical = canonicalSiteUrl(request.url, request.method);
  if (canonical) return NextResponse.redirect(canonical, 307);
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
