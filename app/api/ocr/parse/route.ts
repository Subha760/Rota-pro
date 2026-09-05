import { NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import { consensusText, parseRotaText } from "@/lib/ocr/rota-parser";
import { validateAndAnchor } from "@/lib/date-validator";
export const runtime = "nodejs";
export const maxDuration = 60;
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
async function imageText(bytes: Buffer) {
  const worker = await createWorker("eng");
  try {
    const outputs: string[] = [];
    for (const psm of [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT, PSM.AUTO]) {
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        preserve_interword_spaces: "1",
      });
      outputs.push((await worker.recognize(bytes)).data.text);
    }
    return consensusText(outputs);
  } finally {
    await worker.terminate();
  }
}
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File))
      return NextResponse.json(
        { error: "A rota file is required." },
        { status: 400 },
      );
    if (f.size > 20 * 1024 * 1024)
      return NextResponse.json(
        { error: "Maximum file size is 20 MB." },
        { status: 413 },
      );
    const bytes = Buffer.from(await f.arrayBuffer());
    let text = "";
    if (f.type === "application/pdf")
      text = await pdfText(new Uint8Array(bytes));
    else if (/^image\/(png|jpeg|webp)$/.test(f.type))
      text = await imageText(bytes);
    else
      return NextResponse.json(
        { error: "Unsupported file type." },
        { status: 415 },
      );
    if (text.trim().length < 12)
      return NextResponse.json(
        {
          error:
            "This scan has no reliable readable text. Try a brighter, straighter photo or crop the nurse row in Inspector.",
        },
        { status: 422 },
      );
    const result = validateAndAnchor(parseRotaText(text));
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OCR failed safely." },
      { status: 422 },
    );
  }
}
