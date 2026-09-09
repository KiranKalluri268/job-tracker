import { Suspense } from "react";

import { auth, signOut } from "@/auth";
import AppShell from "@/components/AppShell";
import { buildMongoFilter, buildMongoSort, parseFilters } from "@/lib/filters";
import { applications } from "@/lib/mongodb";
import { serialize } from "@/lib/serialize";
import type { Application } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The first page load reads Mongo directly rather than fetching its own API route —
 * one round trip instead of two, and the table is populated in the HTML.
 */
async function loadInitial(
  params: Record<string, string | string[] | undefined>,
): Promise<{ apps: Application[]; error: string | null; serverNow: number }> {
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
    const docs = await col
      .find(buildMongoFilter(filters))
      .sort(buildMongoSort(filters))
      .limit(1000)
      .toArray();
    return { apps: docs.map(serialize), error: null, serverNow };
  } catch (error) {
    // A missing or wrong MONGODB_URI shows up as a banner, not a crashed page.
    return {
      apps: [],
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
  const [session, { apps, error, serverNow }] = await Promise.all([
    safeAuth(),
    loadInitial(await searchParams),
  ]);

  return (
    // AppShell reads useSearchParams, which Next requires to sit under a Suspense
    // boundary so the rest of the page can still be prerendered.
    <Suspense fallback={null}>
      <AppShell
        initialApplications={apps}
        initialError={error}
        userEmail={session?.user?.email ?? null}
        signOutSlot={<SignOutButton />}
        serverNow={serverNow}
      />
    </Suspense>
  );
}
