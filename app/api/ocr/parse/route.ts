import { NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import { ocrQuality, parseRotaText } from "@/lib/ocr/rota-parser";
import { validateAndAnchor } from "@/lib/date-validator";

export const runtime = "nodejs";
export const maxDuration = 60;

const OCR_TIMEOUT_MS = 52_000;

async function pdfText(data: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((x) => ("str" in x ? x.str : "")).join(" "));
  }
  return pages.join("\n");
}

async function recognize(worker: Awaited<ReturnType<typeof createWorker>>, bytes: Buffer, psm: PSM) {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const result = await worker.recognize(bytes, { rotateAuto: true });
  return result.data.text;
}

async function imageText(bytes: Buffer) {
  const worker = await createWorker("eng");
  try {
    const first = await recognize(worker, bytes, PSM.AUTO);
    if (ocrQuality(first) >= 0.64) return first;

    // A second layout is only run for weak scans. This avoids the old three-pass
    // bottleneck while recovering cells from sparse or photographed tables.
    const second = await recognize(worker, bytes, PSM.SPARSE_TEXT);
    return ocrQuality(second) > ocrQuality(first) ? second : first;
  } finally {
    await worker.terminate();
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timed out. Crop the rota to the table and retry.")), milliseconds),
    ),
  ]);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File))
      return NextResponse.json({ error: "A rota file is required." }, { status: 400 });
    if (f.size > 20 * 1024 * 1024)
      return NextResponse.json({ error: "Maximum file size is 20 MB." }, { status: 413 });

    const bytes = Buffer.from(await f.arrayBuffer());
    let text = "";
    if (f.type === "application/pdf") {
      text = await pdfText(new Uint8Array(bytes));
      if (text.trim().length < 12)
        return NextResponse.json(
          { error: "This PDF is image-only. Export its rota page as a clear JPG/PNG and upload it." },
          { status: 422 },
        );
    } else if (/^image\/(png|jpeg|webp)$/.test(f.type)) {
      text = await withTimeout(imageText(bytes), OCR_TIMEOUT_MS);
    } else {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
    }

    if (text.trim().length < 12)
      return NextResponse.json(
        { error: "No reliable text was found. Crop to the rota table, keep it straight, and retry." },
        { status: 422 },
      );

    const result = validateAndAnchor(parseRotaText(text));
    return NextResponse.json(
      { ...result, diagnostics: { quality: ocrQuality(text) } },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OCR failed safely." },
      { status: 422 },
    );
  }
}
