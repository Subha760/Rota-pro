import { Activity, Moon, ShieldCheck, Timer, TreePalm } from "lucide-react";
import { shiftFor } from "@/lib/shift-definitions";
import type { ScheduleDay } from "@/types/rota";
export function AnalyticsWidget({ schedule }: { schedule: ScheduleDay[] }) {
  const hours = schedule.reduce((n, d) => n + shiftFor(d.raw_code).hours, 0);
  const nights = schedule.filter((d) => d.normalized_type === "NIGHT").length;
  const leaves = schedule.filter((d) =>
    ["GH", "CL", "SL", "EL", "COMP_OFF", "MATERNITY", "PATERNITY"].includes(
      d.normalized_type,
    ),
  ).length;
  const offs = schedule.filter((d) => d.normalized_type === "OFF").length;
  let run = 0,
    max = 0;
  for (const d of schedule) {
    if (shiftFor(d.raw_code).hours) {
      run++;
      max = Math.max(max, run);
    } else run = 0;
  }
  const rest = Math.max(
    0,
    Math.round(100 - Math.max(0, max - 5) * 12 - nights * 2),
  );
  const items = [
    { l: "Duty hours", v: hours.toFixed(1), i: Timer, c: "text-teal-300" },
    { l: "Night shifts", v: nights, i: Moon, c: "text-indigo-300" },
    { l: "Leave / holiday", v: leaves, i: TreePalm, c: "text-pink-300" },
    { l: "Rest days", v: offs, i: Activity, c: "text-sky-300" },
    {
      l: "Rest health",
      v: `${rest}%`,
      i: ShieldCheck,
      c: rest > 70 ? "text-emerald-300" : "text-amber-300",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {items.map((x) => (
        <div key={x.l} className="glass rounded-2xl p-4">
          <x.i size={18} className={x.c} />
          <div className="mt-3 text-2xl font-semibold">{x.v}</div>
          <div className="text-xs text-slate-400">{x.l}</div>
        </div>
      ))}
    </div>
  );
}
