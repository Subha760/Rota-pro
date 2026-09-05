# RotaPro Enterprise (Rota2Cal)

Hospital-duty rota extraction, verification, analytics and revision-safe WebCal sync built with Next.js App Router, TypeScript, Tailwind, Framer Motion and Lucide.

## What works

- PNG/JPG/WebP OCR with three local Tesseract consensus passes.
- Text-layer extraction for multi-page PDFs.
- Strict Day 1 through final-day anchoring, leap-year handling and weekday correction.
- Amber review for confidence below 0.92; export stays locked until confirmed.
- Nursing shift/leave dictionary, overnight and split-shift support.
- Stable date-anchored UIDs, revision `SEQUENCE`, cancellation events and alarms.
- Read-only WebCal feed protected by a separate private sync credential.
- IndexedDB offline cache and service-worker app shell.
- Supabase-backed production persistence with RLS and no browser-exposed service key.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apply `supabase/migrations/202609050001_rotapro_feeds.sql` before production. Development falls back to local filesystem storage when Supabase variables are absent.

## Safety and interoperability

RotaPro does not silently guess: uncertain cells must be confirmed before export. Stable `UID` plus increasing `SEQUENCE` is valid RFC 5545 revision metadata, but reliable automatic replacement requires a WebCal subscription. Re-import behavior for downloaded `.ics` files depends on the target calendar client.
