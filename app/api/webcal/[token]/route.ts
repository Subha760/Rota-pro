import { NextResponse } from "next/server";
import { getFeed } from "@/lib/server-feed-store";
import { generateCalendar } from "@/lib/ics-generator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: { token: string } },
) {
  const feed = await getFeed(params.token);
  if (!feed)
    return NextResponse.json(
      { error: "Calendar feed not found." },
      { status: 404 },
    );
  return new NextResponse(generateCalendar(feed), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="rotapro-${feed.revision.year}-${String(feed.revision.month).padStart(2, "0")}.ics"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
