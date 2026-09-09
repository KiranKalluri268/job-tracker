import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export type Role = "admin" | "viewer";

/**
 * Local escape hatch (`npm run dev:local`): auth is skipped and every request is
 * treated as an admin. Double-gated so a stray env var on Vercel — where NODE_ENV
 * is always "production" — cannot unlock the app.
 */
export const AUTH_DISABLED =
  process.env.DISABLE_AUTH === "1" && process.env.NODE_ENV !== "production";

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Two allowlists make up the whole authorization model:
 *  - ADMIN_EMAILS can read and edit.
 *  - VIEW_EMAILS can read only.
 * ALLOWED_EMAILS is still read as an admin list so a deployment that predates the
 * split keeps working until its env vars are updated.
 */
function adminEmails(): string[] {
  return parseList(process.env.ADMIN_EMAILS ?? process.env.ALLOWED_EMAILS);
}

function viewerEmails(): string[] {
  return parseList(process.env.VIEW_EMAILS);
}

/** The role for an email, or null when it is on neither list (sign-in denied). */
export function roleForEmail(email: string | null | undefined): Role | null {
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  if (adminEmails().includes(e)) return "admin";
  if (viewerEmails().includes(e)) return "viewer";
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    signIn({ profile }) {
      // A missing env var yields empty lists, which locks everyone out rather than
      // letting everyone in — this must never fail open.
      return roleForEmail(profile?.email) !== null;
    },
    jwt({ token }) {
      // Recomputed on every refresh so moving an address between the lists takes
      // effect without the user signing out first.
      token.role = roleForEmail(token.email) ?? undefined;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.role = (token.role as Role | undefined) ?? "viewer";
      return session;
    },
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
  },
});
