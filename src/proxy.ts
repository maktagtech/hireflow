import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Optimistic auth redirects for pages. Route handlers still verify the
 * session themselves (requireUser) — this only improves navigation.
 */
const APP_PAGES = ["/dashboard", "/profile", "/applications", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));

  if (!signedIn && APP_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // Only bounce signed-in users off /login on full page loads. Redirecting a router
  // prefetch would hand the client a segment for the wrong route (a 404).
  const isDocument = req.headers.get("sec-fetch-dest") === "document" && !req.nextUrl.searchParams.has("_rsc");
  if (signedIn && AUTH_PAGES.includes(pathname) && isDocument) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/applications/:path*", "/settings/:path*", "/login", "/signup"],
};
