"use client";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CloudCog,
  Download,
  Eye,
  LockKeyhole,
  RefreshCw,
  Share2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { CalendarGrid } from "@/components/CalendarGrid";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { diffSchedules } from "@/lib/ics-generator";
import {
  getProfile,
  getRevision,
  rotaKey,
  saveProfile,
  saveRevision,
} from "@/lib/storage";
import { normalizeDay } from "@/lib/shift-definitions";
import type {
  RotaExtractionResult,
  RotaProfile,
  RotaRevision,
  ScheduleDay,
} from "@/types/rota";
const demo = (): RotaExtractionResult => {
  const year = 2026,
    month = 9,
    codes = [
      "M",
      "M",
      "E",
      "OFF",
      "N",
      "N",
      "OFF",
      "D",
      "D",
      "CL",
      "M",
      "E",
      "OFF",
      "N",
      "N",
      "OFF",
      "L",
      "L",
      "GH",
      "M",
      "E",
      "OFF",
      "SPL",
      "D",
      "D",
      "OFF",
      "N",
      "N",
      "OFF",
      "EL",
    ];
  return {
    metadata: {
      detected_month: month,
      detected_year: year,
      staff_name: "Subhajit",
      staff_id: "NUR-2048",
      ward_unit: "Emergency Unit",
      total_days: 30,
      timezone: "Asia/Kolkata",
    },
    schedule: codes.map((c, i) => ({
      ...normalizeDay(i + 1, c, i === 11 ? 0.86 : 0.99),
      day_of_week: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        new Date(Date.UTC(year, month - 1, i + 1)).getUTCDay()
      ],
    })),
  };
};
const secret = () => {
  const a = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
};
export default function Home() {
  const [result, setResult] = useState<RotaExtractionResult>(demo);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(result.schedule);
  const [mode, setMode] = useState<"autopilot" | "inspector">("autopilot");
  const [syncing, setSyncing] = useState(false);
  const [webcal, setWebcal] = useState("");
  const [notice, setNotice] = useState(
    "Demo rota loaded · upload yours to replace it",
  );
  useEffect(() => {
    setSchedule(result.schedule);
  }, [result]);
  const ambiguous = schedule.filter((x) => x.is_ambiguous).length;
  const monthName = new Intl.DateTimeFormat("en", { month: "long" }).format(
    new Date(result.metadata.detected_year, result.metadata.detected_month - 1),
  );
  const ready = ambiguous === 0;
  async function sync(download = false) {
    if (!ready) {
      setNotice(
        `Confirm ${ambiguous} amber cell${ambiguous === 1 ? "" : "s"} before export.`,
      );
      return;
    }
    setSyncing(true);
    try {
      const existing = await getProfile();
      const syncSecret = existing?.syncSecret || secret();
      const nurseId = (result.metadata.staff_id || result.metadata.staff_name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const profile: RotaProfile = {
        id: "me",
        nurseId,
        staffName: result.metadata.staff_name,
        staffId: result.metadata.staff_id,
        wardUnit: result.metadata.ward_unit,
        timezone: "Asia/Kolkata",
        reminderMinutes: 90,
        includeLeave: true,
        includeOff: false,
        syncSecret,
      };
      const old = await getRevision(
        nurseId,
        result.metadata.detected_year,
        result.metadata.detected_month,
      );
      const diff = diffSchedules(old?.schedule, schedule);
      const modified = diff.some((x) => x.kind !== "UNCHANGED");
      const sequence = old ? old.sequence + (modified ? 1 : 0) : 0;
      const revision: RotaRevision = {
        key: rotaKey(
          nurseId,
          result.metadata.detected_year,
          result.metadata.detected_month,
        ),
        nurseId,
        year: result.metadata.detected_year,
        month: result.metadata.detected_month,
        sequence,
        updatedAt: new Date().toISOString(),
        schedule,
      };
      const r = await fetch("/api/rota/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${syncSecret}`,
        },
        body: JSON.stringify({ profile, revision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Sync failed");
      profile.webcalToken = data.token;
      await Promise.all([saveProfile(profile), saveRevision(revision)]);
      const url = `${location.origin}${data.webcalPath}`;
      setWebcal(url);
      setNotice(
        `Revision ${sequence} synced · ${diff.filter((x) => x.kind !== "UNCHANGED").length} change(s)`,
      );
      if (download) {
        const blob = await (await fetch(data.webcalPath)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `rotapro-${revision.year}-${String(revision.month).padStart(2, "0")}.ics`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }
  const onParsed = (r: RotaExtractionResult) => {
    setResult(r);
    setSchedule(r.schedule);
    setMode(r.schedule.some((x) => x.is_ambiguous) ? "inspector" : "autopilot");
    setNotice(
      `Anchored ${r.schedule.length} dates · ${r.schedule.filter((x) => x.is_ambiguous).length} require confirmation`,
    );
  };
  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-3 pb-16 pt-4 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-teal-300 p-2.5 text-slate-950">
            <CalendarClock />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight">
              RotaPro{" "}
              <span className="font-medium text-teal-300">Enterprise</span>
            </div>
            <div className="text-[10px] uppercase tracking-[.26em] text-slate-500">
              Rota2Cal · clinical grade
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
          Offline ready
        </div>
      </header>
      <section className="glass grid-dots mb-5 overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-200">
            <Sparkles size={13} />
            Zero-duplicate calendar intelligence
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            From ward rota to a calendar you can trust.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Date-anchored extraction, human verification, deterministic event
            IDs and revision-aware WebCal sync—built for real hospital
            schedules.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300">
          {(
            [
              [LockKeyhole, "Private row isolation"],
              [RefreshCw, "Auto-overwrite revisions"],
              [WifiOff, "Basement-ready PWA"],
              [Eye, "Amber zero-guess review"],
            ] as [LucideIcon, string][]
          ).map(([I, t]) => (
            <span
              key={t}
              className="flex items-center gap-2 rounded-full bg-slate-950/50 px-3 py-2"
            >
              <I size={13} className="text-teal-300" />
              {t}
            </span>
          ))}
        </div>
      </section>
      <AnalyticsWidget schedule={schedule} />
      <div className="my-5 flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-slate-900 p-1">
          <button
            onClick={() => setMode("autopilot")}
            className={`rounded-lg px-4 py-2 text-sm ${mode === "autopilot" ? "bg-teal-300 font-bold text-slate-950" : "text-slate-400"}`}
          >
            Autopilot
          </button>
          <button
            onClick={() => setMode("inspector")}
            className={`rounded-lg px-4 py-2 text-sm ${mode === "inspector" ? "bg-sky-300 font-bold text-slate-950" : "text-slate-400"}`}
          >
            Pro Inspector
          </button>
        </div>
        <div className="text-right">
          <div className="font-semibold">
            {monthName} {result.metadata.detected_year}
          </div>
          <div className="text-xs text-slate-500">
            {result.metadata.staff_name} ·{" "}
            {result.metadata.ward_unit || "Unit not set"}
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <UploadZone onParsed={onParsed} />
        <CalendarGrid
          year={result.metadata.detected_year}
          month={result.metadata.detected_month}
          schedule={schedule}
          onChange={setSchedule}
        />
      </div>
      <section className="glass mt-5 flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <CloudCog className="text-teal-300" />
            Live calendar control
          </div>
          <p className="mt-1 text-xs text-slate-400">{notice}</p>
          {webcal && (
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  webcal.replace(/^https:/, "webcal:"),
                )
              }
              className="mt-2 max-w-full truncate text-left text-xs text-sky-300 hover:underline"
            >
              {webcal.replace(/^https:/, "webcal:")}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void sync(false)}
            disabled={syncing || !ready}
            className="flex items-center gap-2 rounded-xl border border-teal-400/25 bg-teal-400/10 px-4 py-3 text-sm font-semibold text-teal-200 disabled:opacity-40"
          >
            <Share2 size={16} />
            Sync WebCal
          </button>
          <button
            onClick={() => void sync(true)}
            disabled={syncing || !ready}
            className="flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40"
          >
            <Download size={16} />
            Overwrite-ready .ics
          </button>
        </div>
      </section>
      <footer className="mt-8 text-center text-xs text-slate-600">
        RotaPro never exports colleague or patient details. Verify amber cells
        before clinical use.
      </footer>
    </main>
  );
}
