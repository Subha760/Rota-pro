import { NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import { ocrQuality, parseRotaText } from "@/lib/ocr/rota-parser";
import { validateAndAnchor } from "@/lib/date-validator";

export const runtime = "nodejs";
export const maxDuration = 60;

const OCR_TIMEOUT_MS = 38_000;

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
  const result = await worker.recognize(bytes, { rotateAuto: false });
  return result.data.text;
}

async function enhancedImages(bytes: Buffer) {
  const base = sharp(bytes, { failOn: "none", limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: false })
    .flatten({ background: "white" })
    .grayscale()
    .normalize();
  return Promise.all([
    base.clone().sharpen({ sigma: 1.1 }).png({ colors: 16 }).toBuffer(),
    base.clone().threshold(178).png({ colors: 2 }).toBuffer(),
  ]);
}

async function imageText(bytes: Buffer) {
  const worker = await createWorker("eng");
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void worker.terminate();
  }, OCR_TIMEOUT_MS);
  try {
    const [primary, highContrast] = await enhancedImages(bytes);
    const first = await recognize(worker, primary, PSM.SPARSE_TEXT);
    if (ocrQuality(first) >= 0.64) return first;

    // High contrast is only attempted when the normalised scan is weak.
    const second = await recognize(worker, highContrast, PSM.SINGLE_BLOCK);
    return ocrQuality(second) > ocrQuality(first) ? second : first;
  } catch (error) {
    if (timedOut) throw new Error("OCR timed out. Crop closely around one staff row and retry.");
    throw error;
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
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
      text = await imageText(bytes);
    } else {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
    }

    if (text.trim().length < 12)
      return NextResponse.json(
        { error: "No reliable text was found. Crop to the rota table, keep it straight, and retry." },
        { status: 422 },
      );

    const staffName = String(form.get("staffName") || "").trim().slice(0, 80);
    const result = validateAndAnchor(parseRotaText(text, staffName ? { staffName } : {}));
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
