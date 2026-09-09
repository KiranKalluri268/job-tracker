import "server-only";

import { NextResponse } from "next/server";

import { AUTH_DISABLED, auth } from "@/auth";

import { MissingEnvError } from "./mongodb";
import { ValidationError } from "./serialize";

/** Thrown by a write route when the signed-in account only has view access. */
export class ForbiddenError extends Error {}

/**
 * Gate a mutating route on the caller being an admin. Viewers (and anyone not
 * signed in) get a 403 via errorResponse. Mirrors the local escape hatch in proxy.
 */
export async function assertCanEdit(): Promise<void> {
  if (AUTH_DISABLED) return;
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new ForbiddenError("This account has view-only access");
  }
}

/** Map an error thrown anywhere in a route handler to a sensible status + message. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof MissingEnvError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  console.error("[job-tracker]", error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
