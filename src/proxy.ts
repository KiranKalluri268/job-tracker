import { NextResponse } from "next/server";

import { auth } from "@/auth";

/**
 * Escape hatch for local work before Google OAuth is set up (`npm run dev:local`).
 * It is double-gated: the flag must be set AND the build must not be a production
 * one, so a stray env var on Vercel — where NODE_ENV is always "production" — cannot
 * unlock the app.
 */
const authDisabled = process.env.DISABLE_AUTH === "1" && process.env.NODE_ENV !== "production";

// Next 16 renamed the middleware convention to "proxy". NextAuth's `auth` export is
// the handler: it redirects an unauthenticated request to /signin.
export const proxy = authDisabled ? () => NextResponse.next() : auth;

export const config = {
  // Everything except Next's own assets and the auth endpoints themselves.
  matcher: ["/((?!api/auth|api/applications/ingest|signin|_next/static|_next/image|favicon.ico).*)"],
};
