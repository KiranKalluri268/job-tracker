import { type NextRequest } from "next/server";

import { errorResponse } from "@/lib/api";
import { csvFilename, toCsv } from "@/lib/csv";
import { buildMongoFilter, buildMongoSort, parseFilters } from "@/lib/filters";
import { applications } from "@/lib/mongodb";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** Exports exactly what the current filters select, so you get what you're looking at. */
export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const col = await applications();
    const docs = await col.find(buildMongoFilter(filters)).sort(buildMongoSort(filters)).toArray();

    return new Response(toCsv(docs.map(serialize)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename()}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
