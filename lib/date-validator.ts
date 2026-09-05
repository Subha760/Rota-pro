import type { RotaExtractionResult, ScheduleDay } from "@/types/rota";
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();
export const weekday = (year: number, month: number, day: number) =>
  WEEK[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
export function validateAndAnchor(
  result: RotaExtractionResult,
): RotaExtractionResult {
  const { detected_year: y, detected_month: m } = result.metadata;
  if (
    !Number.isInteger(y) ||
    y < 2000 ||
    y > 2100 ||
    !Number.isInteger(m) ||
    m < 1 ||
    m > 12
  )
    throw new Error("Invalid target month or year");
  const total = daysInMonth(y, m);
  const byDay = new Map(result.schedule.map((x) => [x.day, x]));
  const warnings: string[] = [...(result.warnings || [])];
  const schedule: ScheduleDay[] = [];
  for (let day = 1; day <= total; day++) {
    const expected = weekday(y, m, day);
    const found = byDay.get(day);
    if (!found) {
      schedule.push({
        day,
        day_of_week: expected,
        raw_code: "?",
        normalized_type: "CUSTOM",
        is_split_shift: false,
        confidence: 0,
        is_ambiguous: true,
      });
      warnings.push(`Day ${day} was missing.`);
      continue;
    }
    if (found.day_of_week && found.day_of_week.slice(0, 3) !== expected)
      warnings.push(
        `Day ${day} weekday corrected from ${found.day_of_week} to ${expected}.`,
      );
    schedule.push({
      ...found,
      day,
      day_of_week: expected,
      is_ambiguous: found.is_ambiguous || found.confidence < 0.92,
    });
  }
  return {
    metadata: { ...result.metadata, total_days: total },
    schedule,
    warnings: [...new Set(warnings)],
  };
}
