"use client";
import { useRef, useState } from "react";
import {
  Bot,
  Cpu,
  DownloadCloud,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ScheduleDay } from "@/types/rota";
import { shiftFor } from "@/lib/shift-definitions";

const MODELS = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "SmolLM2 360M",
    note: "Fastest · older phones",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 0.5B",
    note: "Balanced",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    note: "Best quality · newer devices",
  },
];
type LocalEngine = Awaited<
  ReturnType<(typeof import("@mlc-ai/web-llm"))["CreateMLCEngine"]>
>;

export function LocalAIAssistant({ schedule }: { schedule: ScheduleDay[] }) {
  const engine = useRef<LocalEngine>();
  const [model, setModel] = useState(MODELS[0].id);
  const [progress, setProgress] = useState("");
  const [ready, setReady] = useState(false);
  const [question, setQuestion] = useState("When is my next night shift?");
  const [answer, setAnswer] = useState(
    "Your rota stays on this device. Load a model once, then ask about duties, rest periods or monthly workload.",
  );
  const [busy, setBusy] = useState(false);
  const summary = schedule.map((d) => `${d.day}:${d.raw_code}`).join(", ");
  async function load() {
    if (!("gpu" in navigator)) {
      setAnswer(
        "This browser does not support WebGPU. The built-in rota analyser still works without downloading a model.",
      );
      return;
    }
    setBusy(true);
    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      engine.current = await CreateMLCEngine(model, {
        initProgressCallback: (p) =>
          setProgress(`${Math.round(p.progress * 100)}% · ${p.text}`),
      });
      setReady(true);
      setAnswer(
        "Local model ready. It can now answer without sending your rota to a server.",
      );
    } catch (e) {
      setAnswer(
        e instanceof Error
          ? `Model loading failed safely: ${e.message}`
          : "Model loading failed safely.",
      );
    } finally {
      setBusy(false);
    }
  }
  function ruleAnswer(q: string) {
    const lower = q.toLowerCase();
    if (lower.includes("night")) {
      const n = schedule.filter((d) => d.normalized_type === "NIGHT");
      return n.length
        ? `Night duties: ${n.map((d) => `${d.day} ${d.day_of_week}`).join(", ")}. Total: ${n.length}.`
        : "No night shifts detected.";
    }
    if (lower.includes("hour")) {
      const h = schedule.reduce((n, d) => n + shiftFor(d.raw_code).hours, 0);
      return `Your verified rota contains ${h.toFixed(1)} duty hours.`;
    }
    if (lower.includes("off") || lower.includes("rest")) {
      const o = schedule.filter((d) => shiftFor(d.raw_code).hours === 0);
      return `Non-working days: ${o.map((d) => d.day).join(", ") || "none"}.`;
    }
    return "Load a local model for open-ended questions, or ask about nights, duty hours, off days or rest.";
  }
  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    try {
      if (!engine.current) {
        setAnswer(ruleAnswer(question));
        return;
      }
      const response = await engine.current.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are RotaPro's private nurse rota assistant. Use only the supplied schedule. Never invent a shift. If uncertain, say so. Keep answers concise and do not give medical advice.",
          },
          {
            role: "user",
            content: `Schedule (${summary}). Question: ${question}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 180,
      });
      setAnswer(
        response.choices[0]?.message?.content || "No answer generated.",
      );
    } catch {
      setAnswer(`AI failed safely. ${ruleAnswer(question)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-3">
        <div className="rounded-2xl border border-teal-400/15 bg-teal-400/5 p-4">
          <div className="flex items-center gap-2 font-semibold text-teal-200">
            <Cpu size={17} />
            Private local models
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-400">
            The first load downloads the selected free model. Afterwards it is
            cached by the browser.
          </p>
        </div>
        <label className="block text-sm text-slate-400">
          Model
          <select
            value={model}
            disabled={ready || busy}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.note}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => void load()}
          disabled={busy || ready}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 py-3 font-bold text-slate-950 disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : ready ? (
            <ShieldCheck size={17} />
          ) : (
            <DownloadCloud size={17} />
          )}{" "}
          {ready ? "Model ready" : "Load local model"}
        </button>
        {progress && (
          <p className="break-words text-xs leading-5 text-slate-500">
            {progress}
          </p>
        )}
      </div>
      <div className="flex min-h-72 flex-col rounded-2xl border border-white/5 bg-slate-950/35 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="text-sky-300" />
          Rota assistant{" "}
          <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] text-sky-300">
            LOCAL
          </span>
        </div>
        <div className="my-4 flex-1 rounded-2xl bg-white/[.035] p-4 text-sm leading-6 text-slate-300">
          <Sparkles className="mb-2 text-teal-300" size={17} />
          {answer}
        </div>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-teal-400/50"
          />
          <button
            aria-label="Ask local AI"
            onClick={() => void ask()}
            disabled={busy}
            className="rounded-xl bg-sky-300 p-3 text-slate-950 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
