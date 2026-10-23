import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  let origin = url.origin;
  const configuredOrigin = process.env.DATENY_APP_ORIGIN?.trim();
  if (configuredOrigin) {
    try {
      const trusted = new URL(configuredOrigin);
      if (trusted.protocol === "https:" || trusted.hostname === "localhost") origin = trusted.origin;
    } catch {
      // Ignore malformed deployment configuration instead of trusting request forwarding headers.
    }
  }
  const destination = new URL(next, origin);
  if (!isSupabaseConfigured || !code || code.length > 4_096) {
    destination.searchParams.set("authError", "missing_code");
    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    destination.searchParams.set("authError", "oauth_failed");
    return NextResponse.redirect(destination);
  }
  return NextResponse.redirect(destination);
}

