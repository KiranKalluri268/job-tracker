import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * A single-tenant app on a public URL: the allowlist is the whole authorization
 * model. `ALLOWED_EMAILS` takes a comma-separated list of Google accounts, so the
 * list can be grown or changed from Vercel's env var settings without a code change
 * or redeploy of any source file.
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      const allowed = allowedEmails();
      // An empty allowlist locks everyone out rather than letting everyone in —
      // a missing env var must never fail open.
      if (!allowed.length || !email) return false;
      return allowed.includes(email);
    },
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
  },
});
