"use client";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { QuickPalette } from "./QuickPalette";
import { shiftFor } from "@/lib/shift-definitions";
import type { ScheduleDay } from "@/types/rota";
export function CalendarGrid({
  year,
  month,
  schedule,
  onChange,
}: {
  year: number;
  month: number;
  schedule: ScheduleDay[];
  onChange: (v: ScheduleDay[]) => void;
}) {
  const [selected, setSelected] = useState<ScheduleDay | null>(null);
  const offset = new Date(year, month - 1, 1).getDay();
  return (
    <>
      <section className="glass rounded-3xl p-3 sm:p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-300">
              Engine B · Inspector
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Verified calendar map
            </h2>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <RefreshCcw size={13} />
            Tap any day
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
            <div className="py-2" key={x}>
              {x}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`x${i}`} />
          ))}
          {schedule.map((day) => {
            const def = shiftFor(day.raw_code);
            return (
              <button
                key={day.day}
                onClick={() => setSelected(day)}
                className={`relative min-h-20 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:bg-white/10 ${day.is_ambiguous ? "border-amber-400/55 bg-amber-400/5" : "border-white/5 bg-white/[.025]"}`}
              >
                <span className="text-xs text-slate-400">{day.day}</span>
                {day.modified && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-300" />
                )}
                <div
                  className={`mt-3 truncate rounded-lg border px-1.5 py-1 text-center text-xs font-black ${def.badge}`}
                >
                  {day.raw_code}
                </div>
                {day.is_ambiguous && (
                  <AlertTriangle
                    aria-label="Needs confirmation"
                    className="absolute bottom-1 right-1 text-amber-300"
                    size={12}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>
      <QuickPalette
        open={!!selected}
        date={selected ? `${selected.day}/${month}/${year}` : ""}
        onClose={() => setSelected(null)}
        onPick={(code) => {
          if (!selected) return;
          const def = shiftFor(code);
          onChange(
            schedule.map((d) =>
              d.day === selected.day
                ? {
                    ...d,
                    raw_code: def.canonical,
                    normalized_type: def.type,
                    is_split_shift: def.type === "SPLIT",
                    split_segments: def.segments,
                    confidence: 1,
                    is_ambiguous: false,
                    modified: true,
                    previous_code: d.raw_code,
                  }
                : d,
            ),
          );
          setSelected(null);
        }}
      />
    </>
  );
}
