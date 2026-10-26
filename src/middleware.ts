import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side gate for the Admin area.
 *
 * If the request carries no session cookie at all, redirect to /login before
 * the Admin page is ever rendered — so /admin/* cannot be opened directly by
 * URL without signing in. The client RouteGuard and the backend APIs then
 * validate the real session and the admin role (defence in depth).
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("medora_session");

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
