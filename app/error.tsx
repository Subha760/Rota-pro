"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="glass max-w-md rounded-3xl p-7 text-center">
        <AlertTriangle className="mx-auto text-amber-300" size={36} />
        <h1 className="mt-4 text-xl font-bold">RotaPro recovered safely</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Your saved rota remains in offline storage. Retry the screen; no
          calendar update was sent.
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3 font-bold text-slate-950"
        >
          <RotateCcw size={17} />
          Retry safely
        </button>
      </div>
    </main>
  );
}
