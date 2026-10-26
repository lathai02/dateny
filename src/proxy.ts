import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { needsLiteVersion } from "@/lib/legacy-browser";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const discovery = /^\/goi-y\/(solo|couple|friends)$/.exec(pathname);
  if (
    (pathname === "/" || discovery) &&
    !searchParams.has("code") &&
    searchParams.get("view") !== "full" &&
    needsLiteVersion(request.headers.get("user-agent") ?? "")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/lite";
    url.search = "";
    if (discovery) url.searchParams.set("mode", discovery[1]);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "User-Agent");
    return response;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/places|lite|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
