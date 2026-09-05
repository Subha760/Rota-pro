import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { putFeed, getFeed } from "@/lib/server-feed-store";
import { validateAndAnchor } from "@/lib/date-validator";
import type { FeedRecord, RotaProfile, RotaRevision } from "@/types/rota";
export const runtime = "nodejs";
const tokenFor = (s: string) =>
  createHash("sha256").update(s).digest("base64url").slice(0, 40);
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!secret || secret.length < 32)
      return NextResponse.json(
        { error: "Missing secure sync credential." },
        { status: 401 },
      );
    const body = (await req.json()) as {
      profile: RotaProfile;
      revision: RotaRevision;
    };
    if (!body.profile || !body.revision)
      return NextResponse.json(
        { error: "Invalid feed payload." },
        { status: 400 },
      );
    const token = tokenFor(secret);
    const current = await getFeed(token);
    if (current?.profile.syncSecret) {
      const a = Buffer.from(createHash("sha256").update(secret).digest("hex"));
      const b = Buffer.from(current.profile.syncSecret);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        return NextResponse.json(
          { error: "Feed ownership check failed." },
          { status: 403 },
        );
    }
    const anchored = validateAndAnchor({
      metadata: {
        detected_month: body.revision.month,
        detected_year: body.revision.year,
        staff_name: body.profile.staffName,
        total_days: body.revision.schedule.length,
      },
      schedule: body.revision.schedule,
    });
    const now = new Date().toISOString();
    const record: FeedRecord = {
      token,
      profile: {
        ...body.profile,
        webcalToken: token,
        syncSecret: createHash("sha256").update(secret).digest("hex"),
      },
      revision: {
        ...body.revision,
        schedule: anchored.schedule,
        updatedAt: now,
      },
      previousSchedule: current?.revision.schedule,
      updatedAt: now,
    };
    await putFeed(record);
    return NextResponse.json({
      token,
      sequence: record.revision.sequence,
      webcalPath: `/api/webcal/${token}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed." },
      { status: 500 },
    );
  }
}
