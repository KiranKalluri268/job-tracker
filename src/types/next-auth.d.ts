import type { DefaultSession } from "next-auth";

type Role = "admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: {
      role?: Role;
    } & DefaultSession["user"];
  }
}
