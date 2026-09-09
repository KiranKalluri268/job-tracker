import { signIn } from "@/auth";

export const metadata = { title: "Sign in · Job Tracker" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-edge)] bg-[var(--color-panel)] p-6 text-center">
        <h1 className="text-lg font-semibold text-stone-800">Job Tracker</h1>
        <p className="mt-1 text-sm text-stone-500">Private. One account only.</p>

        {error ? (
          <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-500/30 ring-inset">
            That account is not allowed to sign in.
          </p>
        ) : null}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
