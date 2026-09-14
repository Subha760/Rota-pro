import { normalizeDay, shiftFor } from "../shift-definitions";
import { daysInMonth, weekday } from "../date-validator";
import type { RotaExtractionResult, ScheduleDay } from "@/types/rota";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const SHIFT_TOKEN = /^(?:M|MR|MO|E|EV|AF|N|NS|NT|D|GEN|G|L|LD|SPL|SD|OC|ONC|OFF|WO|RD|X|GH|PH|NH|SO|CL|SL|ML|EL|PL|AL|C\/O|CO|COMP|CCL|MAT|PAT|OD|TRG|CME|M\+E|E\+N|M\+N)$/;
const CLEAN = /^[^A-Z0-9/+]+|[^A-Z0-9/+]+$/g;

function fixOcrToken(value: string) {
  return value
    .toUpperCase()
    .replace(CLEAN, "")
    .replace(/^0FF$/, "OFF")
    .replace(/^0D$/, "OD")
    .replace(/^C[\\|]O$/, "C/O")
    .replace(/^(M|E|N)[-–](M|E|N)$/, "$1+$2");
}

function shiftTokens(value: string) {
  return value
    .replace(/[|;,]/g, " ")
    .split(/\s+/)
    .map(fixOcrToken)
    .filter((token) => SHIFT_TOKEN.test(token));
}

export function consensusText(texts: string[]) {
  return texts.sort((a, b) => ocrQuality(b) - ocrQuality(a))[0] || "";
}

export function ocrQuality(text: string) {
  const tokens = shiftTokens(text);
  const hasMonth = MONTHS.some((month) => text.toLowerCase().includes(month));
  const hasYear = /\b20\d{2}\b/.test(text);
  const shiftScore = Math.min(tokens.length / 28, 1);
  return Math.min(1, shiftScore * 0.72 + (hasMonth ? 0.14 : 0) + (hasYear ? 0.14 : 0));
}

function detectedDate(text: string, overrides: { month?: number; year?: number }) {
  const lower = text.toLowerCase();
  const namedMonth = MONTHS.findIndex((month) => lower.includes(month)) + 1;
  const numeric = text.match(/\b(?:0?[1-9]|[12]\d|3[01])[\/.\-](0?[1-9]|1[0-2])[\/.\-](20\d{2})\b/);
  return {
    month: overrides.month || namedMonth || Number(numeric?.[1]),
    year: overrides.year || Number(text.match(/\b(20\d{2})\b/)?.[1] || numeric?.[2]),
  };
}

function bestRotaRow(text: string, total: number) {
  const candidates = text
    .split(/\r?\n/)
    .map((line) => ({ line, codes: shiftTokens(line) }))
    .filter((candidate) => candidate.codes.length >= Math.min(7, Math.ceil(total / 3)))
    .sort((a, b) => {
      const aFit = Math.abs(total - a.codes.length);
      const bFit = Math.abs(total - b.codes.length);
      return aFit - bFit || b.codes.length - a.codes.length;
    });
  return candidates[0];
}

export function parseRotaText(
  text: string,
  overrides: Partial<{ month: number; year: number; staffName: string; staffId: string; ward: string }> = {},
): RotaExtractionResult {
  const { month, year } = detectedDate(text, overrides);
  if (!month || !year)
    throw new Error("Month and year were not detected. Include the rota heading in the crop and retry.");

  const total = daysInMonth(year, month);
  const numbered = new Map<number, string>();
  const numberedPattern = /\b([1-9]|[12]\d|3[01])\s*[:.)-]?\s*(M\+E|E\+N|M\+N|M|MR|MO|E|EV|AF|N|NS|NT|D|GEN|G|L|LD|SPL|SD|OC|ONC|OFF|0FF|WO|RD|X|GH|PH|NH|SO|CL|SL|ML|EL|PL|AL|C[\\/]O|CO|COMP|CCL|MAT|PAT|OD|TRG|CME)\b/gi;
  let hit: RegExpExecArray | null;
  while ((hit = numberedPattern.exec(text))) numbered.set(Number(hit[1]), fixOcrToken(hit[2]));

  const row = bestRotaRow(text, total);
  const rowCodes = row?.codes || [];
  const allCodes = shiftTokens(text);
  const sequential = rowCodes.length >= Math.ceil(total * 0.55) ? rowCodes : allCodes;
  const warnings: string[] = [];
  const schedule: ScheduleDay[] = [];

  for (let day = 1; day <= total; day++) {
    const numberedCode = numbered.get(day);
    const code = numberedCode || sequential[day - 1];
    const confidence = numberedCode ? 0.98 : row && code ? 0.93 : code ? 0.82 : 0;
    const item = normalizeDay(day, code || "?", confidence);
    schedule.push({ ...item, day_of_week: weekday(year, month, day) });
    if (!code) warnings.push(`Day ${day} needs confirmation.`);
  }

  const inferredName = row?.line
    .replace(new RegExp(row.codes.map((code) => code.replace("+", "\\+")).join("|"), "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    metadata: {
      detected_month: month,
      detected_year: year,
      staff_name:
        overrides.staffName ||
        text.match(/(?:name|staff)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim() ||
        (inferredName && inferredName.length <= 60 ? inferredName : "My rota"),
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
