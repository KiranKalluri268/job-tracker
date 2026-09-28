import { Suspense } from "react";

import { AUTH_DISABLED, auth, signOut } from "@/auth";
import AppShell from "@/components/AppShell";
import { parseFilters, type Cursor } from "@/lib/filters";
import { applications } from "@/lib/mongodb";
import { fetchApplicationPage } from "@/lib/pagination";
import type { Application } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The first page load reads Mongo directly rather than fetching its own API route —
 * one round trip instead of two, and the table is populated in the HTML. Only the
 * first page's worth, though — the rest is filled in client-side, page by page, via
 * the same keyset cursor the API route uses (see AppShell).
 */
async function loadInitial(params: Record<string, string | string[] | undefined>): Promise<{
  apps: Application[];
  cursor: Cursor<string> | null;
  error: string | null;
  serverNow: number;
}> {
  // Read here rather than in the JSX: the client needs the same instant the HTML was
  // rendered at, and calling Date.now() during render is impure.
  const serverNow = Date.now();
  try {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") search.set(key, value);
    }
    const filters = parseFilters(search);
    const col = await applications();
    const { applications: apps, nextCursor } = await fetchApplicationPage(col, filters, null);
    return { apps, cursor: nextCursor, error: null, serverNow };
  } catch (error) {
    // A missing or wrong MONGODB_URI shows up as a banner, not a crashed page.
    return {
      apps: [],
      cursor: null,
      error: error instanceof Error ? error.message : "Could not reach the database",
      serverNow,
    };
  }
}

/** With DISABLE_AUTH set there is no session to read, and calling auth() would throw. */
async function safeAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}

/** NextAuth v5 signs out over POST, so this is a form rather than a link. */
function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button type="submit" className="underline-offset-2 hover:text-stone-600 hover:underline">
        Sign out
      </button>
    </form>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, { apps, cursor, error, serverNow }] = await Promise.all([
    safeAuth(),
    loadInitial(await searchParams),
  ]);

  // Admins can edit; viewers get a read-only UI. Local auth-disabled mode is an admin.
  const canEdit = AUTH_DISABLED || session?.user?.role === "admin";

  return (
    // AppShell reads useSearchParams, which Next requires to sit under a Suspense
    // boundary so the rest of the page can still be prerendered.
    <Suspense fallback={null}>
      <AppShell
        initialApplications={apps}
        initialCursor={cursor}
        initialError={error}
        userEmail={session?.user?.email ?? null}
        canEdit={canEdit}
        signOutSlot={<SignOutButton />}
        serverNow={serverNow}
      />
    </Suspense>
  );
}
