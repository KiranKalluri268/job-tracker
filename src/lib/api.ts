import "server-only";

import { NextResponse } from "next/server";

import { MissingEnvError } from "./mongodb";
import { ValidationError } from "./serialize";

/** Map an error thrown anywhere in a route handler to a sensible status + message. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof MissingEnvError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  console.error("[job-tracker]", error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
