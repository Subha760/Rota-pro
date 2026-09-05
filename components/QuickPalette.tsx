"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { PALETTE_CODES, shiftFor } from "@/lib/shift-definitions";
export function QuickPalette({
  open,
  date,
  onClose,
  onPick,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onPick: (x: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-3 sm:place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Confirm shift for ${date}`}
            className="glass w-full max-w-md rounded-3xl p-5"
            initial={{ y: 30, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-300">
                  Quick override
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Confirm shift for {date}
                </h2>
              </div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="rounded-xl p-2 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PALETTE_CODES.map((c) => (
                <button
                  key={c}
                  onClick={() => onPick(c)}
                  className={`rounded-xl border px-2 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${shiftFor(c).badge}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
