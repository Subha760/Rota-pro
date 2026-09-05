import type { NormalizedShift, SplitSegment } from "@/types/rota";
export interface ShiftDefinition {
  canonical: string;
  aliases: string[];
  type: NormalizedShift;
  label: string;
  start?: string;
  end?: string;
  overnight?: boolean;
  hours: number;
  calendar: "timed" | "all-day" | "omit";
  color: string;
  badge: string;
  segments?: SplitSegment[];
}
export const SHIFT_DEFINITIONS: ShiftDefinition[] = [
  {
    canonical: "M",
    aliases: ["M", "MR", "MO"],
    type: "MORNING",
    label: "Morning",
    start: "07:00",
    end: "15:00",
    hours: 8,
    calendar: "timed",
    color: "#2dd4bf",
    badge: "bg-teal-400/15 text-teal-200 border-teal-400/30",
  },
  {
    canonical: "E",
    aliases: ["E", "EV", "AF"],
    type: "EVENING",
    label: "Evening",
    start: "13:00",
    end: "21:00",
    hours: 8,
    calendar: "timed",
    color: "#f59e0b",
    badge: "bg-amber-400/15 text-amber-200 border-amber-400/30",
  },
  {
    canonical: "N",
    aliases: ["N", "NS", "NT"],
    type: "NIGHT",
    label: "Night",
    start: "20:30",
    end: "08:00",
    overnight: true,
    hours: 11.5,
    calendar: "timed",
    color: "#818cf8",
    badge: "bg-indigo-400/15 text-indigo-200 border-indigo-400/30",
  },
  {
    canonical: "D",
    aliases: ["D", "GEN", "G"],
    type: "GENERAL_DAY",
    label: "General",
    start: "08:30",
    end: "17:00",
    hours: 8.5,
    calendar: "timed",
    color: "#38bdf8",
    badge: "bg-sky-400/15 text-sky-200 border-sky-400/30",
  },
  {
    canonical: "L",
    aliases: ["L", "LD"],
    type: "LONG_DAY",
    label: "Long day",
    start: "07:30",
    end: "20:30",
    hours: 13,
    calendar: "timed",
    color: "#fb7185",
    badge: "bg-rose-400/15 text-rose-200 border-rose-400/30",
  },
  {
    canonical: "SPL",
    aliases: ["SPL", "SD"],
    type: "SPLIT",
    label: "Split",
    hours: 8,
    calendar: "timed",
    color: "#c084fc",
    badge: "bg-purple-400/15 text-purple-200 border-purple-400/30",
    segments: [
      { start: "08:00", end: "12:00", title: "Split duty 1" },
      { start: "16:00", end: "20:00", title: "Split duty 2" },
    ],
  },
  {
    canonical: "OC",
    aliases: ["OC", "ONC"],
    type: "ON_CALL",
    label: "On call",
    start: "08:00",
    end: "20:00",
    hours: 12,
    calendar: "timed",
    color: "#a3e635",
    badge: "bg-lime-400/15 text-lime-200 border-lime-400/30",
  },
  {
    canonical: "OFF",
    aliases: ["OFF", "WO", "RD", "X"],
    type: "OFF",
    label: "Rest day",
    hours: 0,
    calendar: "omit",
    color: "#64748b",
    badge: "bg-slate-400/10 text-slate-300 border-slate-500/30",
  },
  {
    canonical: "GH",
    aliases: ["GH", "PH", "NH"],
    type: "GH",
    label: "Public holiday",
    hours: 0,
    calendar: "all-day",
    color: "#22c55e",
    badge: "bg-green-400/15 text-green-200 border-green-400/30",
  },
  {
    canonical: "CL",
    aliases: ["CL"],
    type: "CL",
    label: "Casual leave",
    hours: 0,
    calendar: "all-day",
    color: "#f472b6",
    badge: "bg-pink-400/15 text-pink-200 border-pink-400/30",
  },
  {
    canonical: "SL",
    aliases: ["SL", "ML"],
    type: "SL",
    label: "Sick leave",
    hours: 0,
    calendar: "all-day",
    color: "#ef4444",
    badge: "bg-red-400/15 text-red-200 border-red-400/30",
  },
  {
    canonical: "EL",
    aliases: ["EL", "PL", "AL"],
    type: "EL",
    label: "Earned leave",
    hours: 0,
    calendar: "all-day",
    color: "#e879f9",
    badge: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-400/30",
  },
  {
    canonical: "C/O",
    aliases: ["C/O", "CO", "COMP"],
    type: "COMP_OFF",
    label: "Comp off",
    hours: 0,
    calendar: "all-day",
    color: "#14b8a6",
    badge: "bg-teal-400/15 text-teal-200 border-teal-400/30",
  },
  {
    canonical: "MAT",
    aliases: ["MAT", "CCL"],
    type: "MATERNITY",
    label: "Family leave",
    hours: 0,
    calendar: "all-day",
    color: "#fb7185",
    badge: "bg-rose-400/15 text-rose-200 border-rose-400/30",
  },
  {
    canonical: "PAT",
    aliases: ["PAT"],
    type: "PATERNITY",
    label: "Paternity leave",
    hours: 0,
    calendar: "all-day",
    color: "#60a5fa",
    badge: "bg-blue-400/15 text-blue-200 border-blue-400/30",
  },
  {
    canonical: "OD",
    aliases: ["OD", "TRG", "CME"],
    type: "ON_DUTY",
    label: "Official duty",
    start: "08:30",
    end: "17:00",
    hours: 8.5,
    calendar: "timed",
    color: "#06b6d4",
    badge: "bg-cyan-400/15 text-cyan-200 border-cyan-400/30",
  },
];
export const PALETTE_CODES = [
  "M",
  "E",
  "N",
  "D",
  "L",
  "SPL",
  "OFF",
  "GH",
  "CL",
  "SL",
  "EL",
  "C/O",
  "MAT",
  "OD",
];
export function shiftFor(code: string) {
  const c = code.trim().toUpperCase().replace(/\s+/g, "");
  return (
    SHIFT_DEFINITIONS.find((s) => s.aliases.includes(c)) ?? {
      canonical: c || "?",
      aliases: [c],
      type: "CUSTOM" as const,
      label: "Custom",
      hours: 0,
      calendar: "omit" as const,
      color: "#94a3b8",
      badge: "bg-slate-400/10 text-slate-200 border-slate-400/30",
    }
  );
}
export function normalizeDay(
  day: number,
  code: string,
  confidence = 1,
): import("@/types/rota").ScheduleDay {
  const s = shiftFor(code);
  return {
    day,
    day_of_week: "",
    raw_code: s.canonical,
    normalized_type: s.type,
    is_split_shift: s.type === "SPLIT",
    split_segments: s.segments,
    confidence,
    is_ambiguous: confidence < 0.92 || s.type === "CUSTOM",
  };
}
