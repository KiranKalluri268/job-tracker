import { NextResponse } from "next/server";

import { AUTH_DISABLED, auth } from "@/auth";

// Next 16 renamed the middleware convention to "proxy". NextAuth's `auth` export is
// the handler: it redirects an unauthenticated request to /signin. AUTH_DISABLED is
// the local escape hatch (`npm run dev:local`), double-gated in @/auth so a stray
// env var on Vercel cannot unlock the app.
export const proxy = AUTH_DISABLED ? () => NextResponse.next() : auth;

export const config = {
  // Everything except Next's own assets and the auth endpoints themselves.
  matcher: ["/((?!api/auth|api/applications/ingest|signin|_next/static|_next/image|favicon.ico).*)"],
};
