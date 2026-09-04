import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { errorResponse } from "@/lib/api";
import { applications } from "@/lib/mongodb";
import { newDocument, sanitizeInput, ValidationError } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * Constant-time comparison so a mistaken token doesn't leak timing information
 * about how many leading characters matched.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.INGEST_API_TOKEN;
  if (!expected) return false; // fail closed if the token was never configured

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type IngestResult = { index: number; error: string };

/**
 * Bulk-ingest endpoint for the LinkedIn job-search automation. This is called by an
 * unattended script rather than a browser, so it authenticates with a bearer token
 * instead of the Google OAuth session (see the matcher in proxy.ts, which carves
 * this path out of the auth gate the same way api/auth already is).
 *
 * Idempotent by postingUrl: re-posting a job already on file is skipped rather than
 * creating a duplicate, so the daily search can re-send overlapping results safely.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const items = Array.isArray((body as { applications?: unknown })?.applications)
      ? (body as { applications: unknown[] }).applications
      : null;
    if (!items) {
      return NextResponse.json({ error: "Expected { applications: [...] }" }, { status: 400 });
    }

    const col = await applications();
    let inserted = 0;
    let skipped = 0;
    const errors: IngestResult[] = [];

    for (let index = 0; index < items.length; index++) {
      try {
        const input = sanitizeInput(items[index], { requireCore: true });
        if (input.postingUrl) {
          const exists = await col.findOne({ postingUrl: input.postingUrl });
          if (exists) {
            skipped++;
            continue;
          }
        }
        await col.insertOne(newDocument(input));
        inserted++;
      } catch (error) {
        errors.push({
          index,
          error: error instanceof ValidationError ? error.message : "Unexpected error",
        });
      }
    }

    return NextResponse.json({ inserted, skipped, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
