"use client";
import { useRef, useState } from "react";
import {
  Camera,
  FileImage,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import type { RotaExtractionResult } from "@/types/rota";
export function UploadZone({
  onParsed,
}: {
  onParsed: (r: RotaExtractionResult) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("Ready for a rota");
  const [busy, setBusy] = useState(false);
  async function send(file?: File) {
    if (!file) return;
    if (
      !/image\/(png|jpeg|webp)/.test(file.type) &&
      file.type !== "application/pdf"
    ) {
      setStatus("Use PNG, JPG, WebP or PDF");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("File must be under 20 MB");
      return;
    }
    setBusy(true);
    setStatus("Local preprocessing + consensus OCR…");
    try {
      const form = new FormData();
      form.set("file", file);
      const r = await fetch("/api/ocr/parse", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Parse failed");
      onParsed(data);
      setStatus(`${file.name} · ${data.schedule.length} days anchored`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not parse rota");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-300">
            Engine A · Autopilot
          </p>
          <h2 className="mt-1 text-xl font-semibold">Drop. Detect. Verify.</h2>
        </div>
        <div className="rounded-2xl bg-teal-400/10 p-3 text-teal-300">
          <ScanLine />
        </div>
      </div>
      <button
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void send(e.dataTransfer.files[0]);
        }}
        className="grid min-h-48 w-full place-items-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 p-6 text-center transition hover:border-teal-400/60 hover:bg-teal-400/5"
      >
        <span className="grid place-items-center">
          {busy ? (
            <LoaderCircle
              className="mb-3 animate-spin text-teal-300"
              size={34}
            />
          ) : (
            <UploadCloud className="mb-3 text-teal-300" size={34} />
          )}
          <span className="font-semibold">{status}</span>
          <span className="mt-1 text-xs text-slate-400">
            PNG · JPG · WebP · multi-page PDF · 20 MB
          </span>
        </span>
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={(e) => void send(e.target.files?.[0])}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void send(e.target.files?.[0])}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => camera.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-3 text-sm hover:bg-white/10"
        >
          <Camera size={16} />
          Scan with camera
        </button>
        <button
          onClick={() => input.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-3 text-sm hover:bg-white/10"
        >
          <FileImage size={16} />
          Choose document
        </button>
      </div>
      <p className="mt-4 flex gap-2 text-xs leading-5 text-slate-400">
        <ShieldCheck size={16} className="shrink-0 text-teal-300" />
        Ephemeral by default. Source images are parsed in memory and are not
        retained.
      </p>
    </section>
  );
}
