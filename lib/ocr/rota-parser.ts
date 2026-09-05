import { normalizeDay, shiftFor } from "../shift-definitions";
import { daysInMonth, weekday } from "../date-validator";
import type { RotaExtractionResult, ScheduleDay } from "@/types/rota";
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function consensusText(texts: string[]) {
  const lines = texts.flatMap((x) =>
    x
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) || 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map((x) => x[0])
    .join("\n");
}
export function parseRotaText(
  text: string,
  overrides: Partial<{
    month: number;
    year: number;
    staffName: string;
    staffId: string;
    ward: string;
  }> = {},
): RotaExtractionResult {
  const lower = text.toLowerCase();
  const month =
    overrides.month || MONTHS.findIndex((x) => lower.includes(x)) + 1;
  const year = overrides.year || Number(text.match(/\b(20\d{2})\b/)?.[1]);
  if (!month || !year)
    throw new Error(
      "Month and year were not confidently detected. Use Inspector to confirm them.",
    );
  const total = daysInMonth(year, month);
  const tokens = text
    .toUpperCase()
    .replace(/[|]/g, " ")
    .split(/\s+/)
    .map((x) => x.replace(/^[^A-Z0-9/]+|[^A-Z0-9/]+$/g, ""))
    .filter(Boolean);
  const codes = tokens.filter((t) => shiftFor(t).type !== "CUSTOM");
  const numbered = new Map<number, string>();
  const re =
    /\b([1-9]|[12]\d|3[01])\s*[:.)-]?\s*(M|MR|MO|E|EV|AF|N|NS|NT|D|GEN|G|L|LD|SPL|SD|OC|ONC|OFF|WO|RD|X|GH|PH|NH|CL|SL|ML|EL|PL|AL|C\/O|CO|COMP|CCL|MAT|PAT|OD|TRG|CME)\b/gi;
  let hit;
  while ((hit = re.exec(text))) numbered.set(Number(hit[1]), hit[2]);
  const warnings: string[] = [];
  const schedule: ScheduleDay[] = [];
  for (let d = 1; d <= total; d++) {
    const code = numbered.get(d) || codes[d - 1];
    const confidence = numbered.has(d) ? 0.98 : code ? 0.88 : 0;
    const item = normalizeDay(d, code || "?", confidence);
    schedule.push({ ...item, day_of_week: weekday(year, month, d) });
    if (!code) warnings.push(`Day ${d} needs confirmation.`);
  }
  return {
    metadata: {
      detected_month: month,
      detected_year: year,
      staff_name:
        overrides.staffName ||
        text.match(/(?:name|staff)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim() ||
        "My rota",
      staff_id:
        overrides.staffId ||
        text.match(/(?:staff\s*id|employee\s*id|id)\s*[:\-]\s*([\w/-]+)/i)?.[1],
      ward_unit:
        overrides.ward ||
        text.match(/(?:ward|unit)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim(),
      total_days: total,
      timezone: "Asia/Kolkata",
    },
    schedule,
    warnings,
  };
}
