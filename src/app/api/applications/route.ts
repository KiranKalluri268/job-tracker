import { NextResponse, type NextRequest } from "next/server";

import { assertCanEdit, errorResponse } from "@/lib/api";
import { buildMongoFilter, buildMongoSort, parseFilters } from "@/lib/filters";
import { applications } from "@/lib/mongodb";
import { newDocument, sanitizeInput, serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const col = await applications();
    const docs = await col
      .find(buildMongoFilter(filters))
      .sort(buildMongoSort(filters))
      .limit(1000)
      .toArray();
    return NextResponse.json({ applications: docs.map(serialize) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await assertCanEdit();
    const input = sanitizeInput(await request.json(), { requireCore: true });
    const col = await applications();
    const doc = newDocument(input);
    const { insertedId } = await col.insertOne(doc);
    return NextResponse.json({ application: serialize({ ...doc, _id: insertedId }) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
