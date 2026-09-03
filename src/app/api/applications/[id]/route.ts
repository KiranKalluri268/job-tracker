import { NextResponse, type NextRequest } from "next/server";

import { errorResponse } from "@/lib/api";
import { applications } from "@/lib/mongodb";
import { sanitizeInput, serialize, toObjectId, ValidationError } from "@/lib/serialize";
import type { AppEvent, Status } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const _id = toObjectId((await params).id);
    const body = (await request.json()) as Record<string, unknown>;
    const input = sanitizeInput(body, { requireCore: false });
    const col = await applications();

    const existing = await col.findOne({ _id });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ...input, updatedAt: now };
    const ops: Record<string, unknown> = { $set: update };

    const previous = existing.status as Status;
    const next = input.status;
    if (next && next !== previous) {
      // The timeline is written here, never by the client, so history stays honest.
      const event: AppEvent = {
        at: now,
        from: previous,
        to: next,
        note: typeof body.eventNote === "string" && body.eventNote.trim() ? body.eventNote.trim() : null,
      };
      ops.$push = { events: event };
      // First time it actually goes out, stamp the applied date if it's still blank.
      if (next !== "Saved" && !existing.appliedOn && input.appliedOn === undefined) {
        update.appliedOn = now.slice(0, 10);
      }
    }

    const updated = await col.findOneAndUpdate({ _id }, ops, { returnDocument: "after" });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ application: serialize(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const _id = toObjectId((await params).id);
    const col = await applications();
    const { deletedCount } = await col.deleteOne({ _id });
    if (!deletedCount) throw new ValidationError("Not found");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
