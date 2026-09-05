"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  BrainCircuit,
  Building2,
  Check,
  ChevronRight,
  Crop,
  EyeOff,
  LockKeyhole,
  RefreshCw,
  RotateCw,
  Scale,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ScheduleDay } from "@/types/rota";
import { shiftFor } from "@/lib/shift-definitions";
import { LocalAIAssistant } from "./LocalAIAssistant";

type Tab = "inspector" | "swap" | "ai" | "custom" | "teams" | "privacy";
const TABS: { id: Tab; label: string; icon: typeof Crop }[] = [
  { id: "inspector", label: "Document", icon: Crop },
  { id: "swap", label: "Shift swap", icon: UsersRound },
  { id: "ai", label: "Local AI", icon: BrainCircuit },
  { id: "custom", label: "Custom shift", icon: Settings2 },
  { id: "teams", label: "Workplaces", icon: Building2 },
  { id: "privacy", label: "Privacy", icon: LockKeyhole },
];

function DocumentInspector({
  documentUrl,
  documentType,
}: {
  documentUrl?: string;
  documentType?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [contrast, setContrast] = useState(110);
  const [brightness, setBrightness] = useState(100);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="relative grid min-h-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 place-items-center">
        {documentUrl ? (
          documentType === "application/pdf" ? (
            <iframe
              title="Uploaded rota"
              src={documentUrl}
              className="h-[28rem] w-full"
            />
          ) : (
            <Image
              alt="Uploaded rota under inspection"
              src={documentUrl}
              width={1400}
              height={1000}
              unoptimized
              className="max-h-[34rem] max-w-full transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                filter: `contrast(${contrast}%) brightness(${brightness}%)`,
              }}
            />
          )
        ) : (
          <div className="max-w-sm px-8 text-center text-slate-500">
            <BrainCircuit className="mx-auto mb-3" />
            <p className="font-medium text-slate-300">
              Upload a rota to inspect it here
            </p>
            <p className="mt-1 text-sm">
              The image remains in this browser session only.
            </p>
          </div>
        )}
        {documentUrl && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-xl border border-white/10 bg-slate-950/90 p-1.5 shadow-xl">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((x) => Math.max(0.6, x - 0.15))}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <ZoomOut size={17} />
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((x) => Math.min(2.5, x + 0.15))}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <ZoomIn size={17} />
            </button>
            <button
              aria-label="Rotate"
              onClick={() => setRotation((x) => (x + 90) % 360)}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <RotateCw size={17} />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <Control
          label="Contrast"
          value={contrast}
          min={60}
          max={180}
          onChange={setContrast}
        />
        <Control
          label="Brightness"
          value={brightness}
          min={50}
          max={160}
          onChange={setBrightness}
        />
        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Scale size={16} />
            Row isolation
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-400">
            Zoom and crop visually, then compare the locked nurse row against
            the calendar cells. Colleague rows are never serialized.
          </p>
        </div>
        <button
          onClick={() => {
            setZoom(1);
            setRotation(0);
            setContrast(110);
            setBrightness(100);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm hover:bg-white/10"
        >
          <RefreshCw size={15} />
          Reset view
        </button>
      </div>
    </div>
  );
}
function Control({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block rounded-2xl bg-white/[.035] p-4">
      <span className="mb-3 flex justify-between text-sm">
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={15} />
          {label}
        </span>
        <span className="text-teal-300">{value}%</span>
      </span>
      <input
        className="w-full accent-teal-300"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function SwapAssistant({ schedule }: { schedule: ScheduleDay[] }) {
  const [peer, setPeer] = useState(
    "OFF E M OFF N D OFF M E OFF D N OFF M E OFF D N OFF M E OFF D N OFF M E OFF D N",
  );
  const options = useMemo(() => {
    const peerCodes = peer
      .toUpperCase()
      .split(/[\s,]+/)
      .filter(Boolean);
    return schedule.flatMap((mine, i) => {
      const theirs = peerCodes[i];
      if (!theirs) return [];
      const myOff = shiftFor(mine.raw_code).hours === 0;
      const theirOff = shiftFor(theirs).hours === 0;
      if (myOff === theirOff) return [];
      return [
        {
          day: mine.day,
          mine: mine.raw_code,
          theirs,
          reason: myOff ? "You are free" : "Peer is free",
        },
      ];
    });
  }, [schedule, peer]);
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div>
        <label className="text-sm font-medium">Peer’s monthly codes</label>
        <textarea
          value={peer}
          onChange={(e) => setPeer(e.target.value)}
          className="mt-2 h-40 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 outline-none focus:border-teal-400/50"
          placeholder="M E N OFF …"
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Paste codes in date order. No name, phone number or staff ID is
          needed.
        </p>
      </div>
      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {options.length ? (
          options.map((x) => (
            <div
              key={x.day}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.035] p-3"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-400/10 font-bold text-teal-200">
                {x.day}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {x.mine} ↔ {x.theirs}
                </div>
                <div className="text-xs text-slate-500">
                  {x.reason} · conflict-free candidate
                </div>
              </div>
              <button className="rounded-xl border border-teal-400/20 px-3 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-400/10">
                Propose
              </button>
            </div>
          ))
        ) : (
          <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-700 text-sm text-slate-500">
            No conflict-free swaps detected
          </div>
        )}
      </div>
    </div>
  );
}

function CustomShiftBuilder() {
  const [name, setName] = useState("Late duty");
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("22:00");
  const [alarm, setAlarm] = useState(90);
  const [split, setSplit] = useState(false);
  const [saved, setSaved] = useState(false);
  function save() {
    localStorage.setItem(
      "rotapro:custom-shift",
      JSON.stringify({ name, start, end, alarm, split }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Shift name" value={name} onChange={setName} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Starts" type="time" value={start} onChange={setStart} />
        <Field label="Ends" type="time" value={end} onChange={setEnd} />
      </div>
      <label className="rounded-2xl bg-white/[.035] p-4 text-sm">
        <span className="flex justify-between">
          <span>Pre-shift alarm</span>
          <b className="text-teal-300">{alarm} min</b>
        </span>
        <input
          className="mt-4 w-full accent-teal-300"
          type="range"
          min="0"
          max="180"
          step="15"
          value={alarm}
          onChange={(e) => setAlarm(Number(e.target.value))}
        />
      </label>
      <div className="flex items-center justify-between rounded-2xl bg-white/[.035] p-4">
        <div>
          <div className="text-sm font-medium">Dual-interval split</div>
          <div className="text-xs text-slate-500">
            Create two calendar blocks
          </div>
        </div>
        <button
          role="switch"
          aria-checked={split}
          onClick={() => setSplit(!split)}
          className={`relative h-7 w-12 rounded-full transition ${split ? "bg-teal-300" : "bg-slate-700"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${split ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      <button
        onClick={save}
        className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-teal-300 py-3 font-bold text-slate-950"
      >
        {saved ? (
          <>
            <Check size={17} />
            Saved on this device
          </>
        ) : (
          <>
            Save custom shift
            <ChevronRight size={17} />
          </>
        )}
      </button>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 outline-none focus:border-teal-400/50"
      />
    </label>
  );
}

function WorkplaceManager() {
  const [units, setUnits] = useState([
    { name: "Mahe official", locked: false, members: 14 },
    { name: "JM", locked: false, members: 4 },
    { name: "Shanti", locked: true, members: 4 },
  ]);
  const [name, setName] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-2">
        {units.map((unit, index) => (
          <div
            key={unit.name}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.035] p-4"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
              <Building2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{unit.name}</div>
              <div className="text-xs text-slate-500">
                {unit.members} members ·{" "}
                {unit.locked ? "Private rota" : "Shared within Mahe"}
              </div>
            </div>
            <button
              onClick={() =>
                setUnits((items) =>
                  items.map((item, i) =>
                    i === index ? { ...item, locked: !item.locked } : item,
                  ),
                )
              }
              aria-label={`Toggle ${unit.name} privacy`}
              className={`rounded-xl p-2 ${unit.locked ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-slate-400"}`}
            >
              {unit.locked ? (
                <LockKeyhole size={18} />
              ) : (
                <UsersRound size={18} />
              )}
            </button>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-slate-950/35 p-4">
        <div className="font-semibold">Add sub-workplace</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Owners and admins can create units. Members see only shared units or
          units they belong to.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Unit name"
          className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm outline-none focus:border-teal-400/50"
        />
        <button
          onClick={() => {
            if (name.trim()) {
              setUnits((items) => [
                ...items,
                { name: name.trim(), locked: true, members: 0 },
              ]);
              setName("");
            }
          }}
          className="mt-2 w-full rounded-xl bg-teal-300 py-3 text-sm font-bold text-slate-950"
        >
          Create private unit
        </button>
      </div>
    </div>
  );
}

function PrivacyCenter() {
  const [ephemeral, setEphemeral] = useState(true);
  const [redact, setRedact] = useState(true);
  const [alerts, setAlerts] = useState(false);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <PrivacyCard
        icon={EyeOff}
        title="Ephemeral images"
        text="Delete the source from memory after parsing."
        value={ephemeral}
        setValue={setEphemeral}
      />
      <PrivacyCard
        icon={ShieldCheck}
        title="PII redaction"
        text="Exclude colleague names, signatures and patient data."
        value={redact}
        setValue={setRedact}
      />
      <PrivacyCard
        icon={BellRing}
        title="Duty reminders"
        text="Schedule device notifications while keeping the rota local."
        value={alerts}
        setValue={async (v) => {
          if (v && "Notification" in window) {
            const ok = await Notification.requestPermission();
            setAlerts(ok === "granted");
          } else setAlerts(v);
        }}
      />
    </div>
  );
}
function PrivacyCard({
  icon: Icon,
  title,
  text,
  value,
  setValue,
}: {
  icon: typeof EyeOff;
  title: string;
  text: string;
  value: boolean;
  setValue: (v: boolean) => void | Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[.035] p-4">
      <div className="flex items-start justify-between">
        <Icon className="text-teal-300" />
        <button
          role="switch"
          aria-checked={value}
          onClick={() => void setValue(!value)}
          className={`relative h-7 w-12 rounded-full ${value ? "bg-teal-300" : "bg-slate-700"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
    </div>
  );
}

export function AdvancedWorkspace({
  schedule,
  documentUrl,
  documentType,
}: {
  schedule: ScheduleDay[];
  documentUrl?: string;
  documentType?: string;
}) {
  const [tab, setTab] = useState<Tab>("inspector");
  return (
    <section className="glass mt-5 rounded-3xl p-3 sm:p-5">
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-950/45 p-1.5">
        {TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${tab === x.id ? "bg-white/10 font-semibold text-white" : "text-slate-500 hover:text-slate-200"}`}
          >
            <x.icon size={16} />
            {x.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {tab === "inspector" && (
            <DocumentInspector
              documentUrl={documentUrl}
              documentType={documentType}
            />
          )}{" "}
          {tab === "swap" && <SwapAssistant schedule={schedule} />}{" "}
          {tab === "ai" && <LocalAIAssistant schedule={schedule} />}{" "}
          {tab === "custom" && <CustomShiftBuilder />}{" "}
          {tab === "teams" && <WorkplaceManager />}{" "}
          {tab === "privacy" && <PrivacyCenter />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
