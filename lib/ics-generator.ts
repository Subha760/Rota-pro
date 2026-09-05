import { shiftFor } from "./shift-definitions";
import type { CalendarEventInput, FeedRecord, ScheduleDay } from "@/types/rota";
const esc = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const pad = (n: number) => String(n).padStart(2, "0");
const date = (y: number, m: number, d: number) => `${y}${pad(m)}${pad(d)}`;
const stamp = () =>
  new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
function fold(line: string) {
  const out: string[] = [];
  let s = line;
  while (new TextEncoder().encode(s).length > 75) {
    let i = Math.min(73, s.length);
    while (new TextEncoder().encode(s.slice(0, i)).length > 73) i--;
    out.push(s.slice(0, i));
    s = " " + s.slice(i);
  }
  out.push(s);
  return out.join("\r\n");
}
function addDays(y: number, m: number, d: number, n: number) {
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()] as const;
}
function localDateTime(y: number, m: number, d: number, time: string) {
  return `${date(y, m, d)}T${time.replace(":", "")}00`;
}
export const deterministicUid = (
  nurseId: string,
  y: number,
  m: number,
  d: number,
) =>
  `rota-${nurseId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${y}-${pad(m)}-${pad(d)}@rotapro.app`;
function eventLines(
  input: CalendarEventInput,
  segment?: { start: string; end: string; title: string },
  segmentIndex = 0,
) {
  const { day, metadata, nurseId, sequence } = input;
  const def = shiftFor(day.raw_code);
  const baseUid = deterministicUid(
    nurseId,
    metadata.detected_year,
    metadata.detected_month,
    day.day,
  );
  const uid = segmentIndex
    ? baseUid.replace("@", `-s${segmentIndex}@`)
    : baseUid;
  const cancelled = input.cancelled || false;
  const title =
    segment?.title || `${def.label} · ${metadata.ward_unit || "Duty rota"}`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${stamp()}`,
  ];
  if (cancelled) {
    lines.push("STATUS:CANCELLED", `SUMMARY:${esc(`Cancelled · ${title}`)}`);
    const t = def.start || "00:00";
    lines.push(
      `DTSTART;TZID=${metadata.timezone || "Asia/Kolkata"}:${localDateTime(metadata.detected_year, metadata.detected_month, day.day, t)}`,
    );
    lines.push(
      `DTEND;TZID=${metadata.timezone || "Asia/Kolkata"}:${localDateTime(metadata.detected_year, metadata.detected_month, day.day, def.end || t)}`,
    );
  } else if (def.calendar === "all-day") {
    const next = addDays(
      metadata.detected_year,
      metadata.detected_month,
      day.day,
      1,
    );
    lines.push(
      `DTSTART;VALUE=DATE:${date(metadata.detected_year, metadata.detected_month, day.day)}`,
      `DTEND;VALUE=DATE:${date(...next)}`,
      `SUMMARY:${esc(title)}`,
    );
  } else {
    const start = segment?.start || def.start || "08:00",
      end = segment?.end || def.end || "16:00";
    const endDate =
      def.overnight && !segment
        ? addDays(metadata.detected_year, metadata.detected_month, day.day, 1)
        : ([metadata.detected_year, metadata.detected_month, day.day] as const);
    lines.push(
      `DTSTART;TZID=${metadata.timezone || "Asia/Kolkata"}:${localDateTime(metadata.detected_year, metadata.detected_month, day.day, start)}`,
      `DTEND;TZID=${metadata.timezone || "Asia/Kolkata"}:${localDateTime(...endDate, end)}`,
      `SUMMARY:${esc(title)}`,
    );
  }
  lines.push(
    `DESCRIPTION:${esc(`Shift: ${def.label}\nUnit: ${metadata.ward_unit || "Not specified"}\nHours: ${def.hours}\nMonthly cumulative hours: ${input.cumulativeHours ?? 0}`)}`,
    `CATEGORIES:${esc(def.type)}`,
  );
  if (
    !cancelled &&
    def.calendar === "timed" &&
    (input.reminderMinutes ?? 90) > 0
  )
    lines.push(
      "BEGIN:VALARM",
      `TRIGGER:-PT${input.reminderMinutes ?? 90}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(title + " begins soon")}`,
      "END:VALARM",
    );
  lines.push("END:VEVENT");
  return lines;
}
export function generateCalendar(feed: FeedRecord) {
  const { profile, revision } = feed;
  let cumulative = 0;
  const active = new Map(revision.schedule.map((d) => [d.day, d]));
  const previous = new Map(
    (feed.previousSchedule || []).map((d) => [d.day, d]),
  );
  const events: string[][] = [];
  for (const day of revision.schedule) {
    const def = shiftFor(day.raw_code);
    cumulative += def.hours;
    if (def.calendar === "omit") {
      if (
        previous.has(day.day) &&
        shiftFor(previous.get(day.day)!.raw_code).calendar !== "omit"
      )
        events.push(
          eventLines({
            day: previous.get(day.day)!,
            metadata: {
              detected_month: revision.month,
              detected_year: revision.year,
              staff_name: profile.staffName,
              ward_unit: profile.wardUnit,
              total_days: revision.schedule.length,
              timezone: profile.timezone,
            },
            nurseId: profile.nurseId,
            sequence: revision.sequence,
            cancelled: true,
          }),
        );
      continue;
    }
    if (def.type === "SPLIT") {
      (day.split_segments || def.segments || []).forEach((s, i) =>
        events.push(
          eventLines(
            {
              day,
              metadata: {
                detected_month: revision.month,
                detected_year: revision.year,
                staff_name: profile.staffName,
                ward_unit: profile.wardUnit,
                total_days: revision.schedule.length,
                timezone: profile.timezone,
              },
              nurseId: profile.nurseId,
              sequence: revision.sequence,
              reminderMinutes: profile.reminderMinutes,
              cumulativeHours: cumulative,
            },
            s,
            i + 1,
          ),
        ),
      );
    } else
      events.push(
        eventLines({
          day,
          metadata: {
            detected_month: revision.month,
            detected_year: revision.year,
            staff_name: profile.staffName,
            ward_unit: profile.wardUnit,
            total_days: revision.schedule.length,
            timezone: profile.timezone,
          },
          nurseId: profile.nurseId,
          sequence: revision.sequence,
          reminderMinutes: profile.reminderMinutes,
          cumulativeHours: cumulative,
        }),
      );
  }
  for (const [d, old] of previous)
    if (!active.has(d) && shiftFor(old.raw_code).calendar !== "omit")
      events.push(
        eventLines({
          day: old,
          metadata: {
            detected_month: revision.month,
            detected_year: revision.year,
            staff_name: profile.staffName,
            ward_unit: profile.wardUnit,
            total_days: revision.schedule.length,
            timezone: profile.timezone,
          },
          nurseId: profile.nurseId,
          sequence: revision.sequence,
          cancelled: true,
        }),
      );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RotaPro Enterprise//Rota2Cal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(profile.staffName + " · RotaPro")}`,
    `X-WR-TIMEZONE:${profile.timezone}`,
    ...events.flat(),
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
export function diffSchedules(
  before: ScheduleDay[] = [],
  after: ScheduleDay[],
) {
  const b = new Map(before.map((x) => [x.day, x]));
  return after.map((a) => {
    const old = b.get(a.day);
    const kind = !old
      ? "ADDED"
      : old.raw_code !== a.raw_code
        ? shiftFor(a.raw_code).calendar === "omit"
          ? "CANCELLED"
          : "CHANGED"
        : "UNCHANGED";
    return { day: a.day, before: old, after: a, kind } as const;
  });
}
