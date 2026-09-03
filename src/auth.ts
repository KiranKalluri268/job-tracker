import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * A single-tenant app on a public URL: the allowlist is the whole authorization
 * model. `ALLOWED_EMAIL` takes a comma-separated list so a second address can be
 * added without a code change.
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
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
