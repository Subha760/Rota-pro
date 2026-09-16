import { NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import { ocrQuality, parseRotaText } from "@/lib/ocr/rota-parser";
import { validateAndAnchor } from "@/lib/date-validator";
import { weekday } from "@/lib/date-validator";
import { normalizeDay } from "@/lib/shift-definitions";

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
  const result = await worker.recognize(bytes, { rotateAuto: false }, { text: true, tsv: true });
  return result.data;
}

async function enhancedImages(bytes: Buffer) {
  const base = sharp(bytes, { failOn: "none", limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: false })
    .flatten({ background: "white" })
    .grayscale()
    .normalize();
  return Promise.all([
    base.clone().sharpen({ sigma: 1.1 }).png().toBuffer(),
    base.clone().threshold(178).png({ colors: 2 }).toBuffer(),
  ]);
}

type TsvWord = { text: string; confidence: number; left: number; top: number; width: number; height: number };

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function tsvWords(tsv: string | null) {
  return (tsv || "").split("\n").flatMap<TsvWord>((line) => {
    const fields = line.split("\t");
    const text = fields.slice(11).join("\t").trim();
    if (fields[0] !== "5" || !text) return [];
    return [{ text, confidence: Number(fields[10]) || 0, left: Number(fields[6]), top: Number(fields[7]), width: Number(fields[8]), height: Number(fields[9]) }];
  });
}

function findStaffWord(tsv: string | null, staffName: string, minimumSimilarity = 0.55) {
  const wanted = staffName.toUpperCase().replace(/[^A-Z]/g, "");
  if (wanted.length < 3) return undefined;
  return tsvWords(tsv)
    .map((word) => {
      const seen = word.text.toUpperCase().replace(/[^A-Z]/g, "");
      return { word, similarity: seen ? 1 - editDistance(seen, wanted) / Math.max(seen.length, wanted.length) : 0 };
    })
    .filter(({ similarity }) => similarity >= minimumSimilarity)
    .sort((a, b) => b.similarity - a.similarity || b.word.confidence - a.word.confidence)[0]?.word;
}

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function headingDate(tsv: string | null, imageHeight: number) {
  const words = tsvWords(tsv);
  const candidates = words.flatMap((word) => {
    const token = word.text.toLowerCase().replace(/[^a-z]/g, "");
    const matches = MONTH_NAMES.map((month, index) => ({
      month: index + 1,
      name: month,
      similarity: token ? 1 - editDistance(token, month) / Math.max(token.length, month.length) : 0,
    })).filter((match) => match.similarity >= 0.62);
    return matches.map((match) => ({ ...match, word }));
  }).filter(({ word }) => word.top > imageHeight * 0.06 && word.top < imageHeight * 0.76);

  for (const candidate of candidates.sort((a, b) =>
    (b.word.height * 5 + b.similarity * 50) - (a.word.height * 5 + a.similarity * 50))) {
    const sameLine = words
      .filter((word) => Math.abs((word.top + word.height / 2) - (candidate.word.top + candidate.word.height / 2)) <= Math.max(24, candidate.word.height * 1.8))
      .sort((a, b) => a.left - b.left);
    const joined = sameLine.map((word) => word.text.replace(/\D/g, "")).filter(Boolean).join(" ");
    const direct = joined.match(/20\d{2}/)?.[0];
    const compact = joined.replace(/\s+/g, "").match(/20\d{2}/)?.[0];
    const year = Number(direct || compact);
    if (year >= 2020 && year <= 2099) return { month: candidate.month, year, name: candidate.name };
  }
  return undefined;
}

function filenameDate(fileName: string) {
  const match = fileName.match(/(20\d{2})(0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/);
  if (!match) return undefined;
  return { year: Number(match[1]), month: Number(match[2]), name: MONTH_NAMES[Number(match[2]) - 1] };
}

function cellCode(raw: string, inkWidth: number) {
  const token = raw.toUpperCase().replace(/[^A-Z0-9/]/g, "");
  const exact = new Set(["M", "E", "N", "D", "G", "L", "OFF", "GH", "CL", "SL", "EL", "C/O", "N/O", "OD", "WO", "RD"]);
  if (exact.has(token)) return token;
  if (/0?FF|OFF|OF/.test(token)) return "OFF";
  if (token.includes("GH")) return "GH";
  if (token.includes("/") && token.includes("N")) return "N/O";
  if (token === "NO" && inkWidth >= 18) return "N/O";
  if (/^(?:MM|MO|TM|RE|NS|IAL|M)$/.test(token)) return "M";
  if (/^(?:N|NN|NO|ON|CN|NC|IN)$/.test(token)) return "N";
  if (/^(?:E|CE|LE|TE|1E|EL|CED|3)$/.test(token)) return "E";
  return "";
}

async function tableRowText(worker: Awaited<ReturnType<typeof createWorker>>, image: Buffer, tsv: string | null, staffName: string, minimumNameSimilarity = 0.55) {
  const staff = findStaffWord(tsv, staffName, minimumNameSimilarity);
  if (!staff) return undefined;
  const { data, info } = await sharp(image).grayscale().normalize().raw().toBuffer({ resolveWithObject: true });
  const darkness = (x: number, y0: number, y1: number) => {
    let sum = 0;
    const from = Math.max(0, Math.round(y0));
    const to = Math.min(info.height, Math.round(y1));
    for (let y = from; y < to; y++) sum += 255 - data[y * info.width + x];
    return sum / Math.max(1, to - from);
  };
  const y0 = staff.top - 50;
  const y1 = staff.top + staff.height + 50;
  const startMin = Math.max(staff.left + staff.width + 45, 0);
  const startMax = Math.min(startMin + 170, info.width - 100);
  let gridStart = 0;
  let pitch = 0;
  let bestGridScore = -1;
  for (let start = startMin; start <= startMax; start++) {
    for (let candidatePitch = 24; candidatePitch <= 60; candidatePitch++) {
      if (start + candidatePitch * 30 >= info.width) continue;
      let score = 0;
      for (let column = 0; column <= 8; column++) {
        const expected = start + column * candidatePitch;
        score += Math.max(...[-2, -1, 0, 1, 2].map((delta) => darkness(expected + delta, y0, y1)));
      }
      if (score > bestGridScore) { bestGridScore = score; gridStart = start; pitch = candidatePitch; }
    }
  }
  if (!gridStart || !pitch) return undefined;
  // In these rota templates, the remaining part of the name column plus the
  // ID column is consistently about three duty-cell widths. This anchors day
  // 1 even when a letter stroke scores more strongly than a slanted rule.
  const anchoredStart = staff.left + staff.width + pitch * 3;
  let anchoredScore = -1;
  for (let x = Math.round(anchoredStart - pitch * 0.22); x <= Math.round(anchoredStart + pitch * 0.22); x++) {
    const score = darkness(x, y0, y1);
    if (score > anchoredScore) { anchoredScore = score; gridStart = x; }
  }
  const boundaries = [gridStart];
  for (let column = 1; column <= 30; column++) {
    const previous = boundaries[column - 1];
    let bestX = Math.round(previous + pitch);
    let bestScore = -1;
    for (let x = Math.round(previous + pitch - 4); x <= Math.round(previous + pitch + 5); x++) {
      const score = darkness(x, y0, y1);
      if (score > bestScore) { bestScore = score; bestX = x; }
    }
    boundaries.push(Math.round(bestX));
    pitch = pitch * 0.8 + (bestX - previous) * 0.2;
  }
  const horizontalScore = (left: number, right: number, y: number) => {
    let sum = 0;
    for (let x = left; x < right; x++) sum += 255 - data[y * info.width + x];
    return sum / Math.max(1, right - left);
  };
  const firstLeft = boundaries[0] + 3;
  const firstRight = boundaries[1] - 3;
  let rowTop = staff.top - 8;
  let topScore = -1;
  for (let y = staff.top - 20; y <= staff.top - 3; y++) {
    const score = horizontalScore(firstLeft, firstRight, y);
    if (score > topScore) { topScore = score; rowTop = y; }
  }
  let rowBottom = staff.top + staff.height + 3;
  let bottomScore = -1;
  for (let y = staff.top + staff.height; y <= staff.top + staff.height + 16; y++) {
    const score = horizontalScore(firstLeft, firstRight, y);
    if (score > bottomScore) { bottomScore = score; rowBottom = y; }
  }
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, preserve_interword_spaces: "1", user_defined_dpi: "300" });
  const numbered: string[] = [];
  const confidences: number[] = [];
  const codes: string[] = [];
  for (let day = 0; day < 30; day++) {
    const left = Math.max(0, Math.round(boundaries[day] + 4));
    const right = Math.min(info.width, Math.round(boundaries[day + 1] - 4));
    if (right <= left || left >= info.width) break;
    if (day > 0) {
      const priorTop = rowTop;
      const priorBottom = rowBottom;
      topScore = -1;
      bottomScore = -1;
      for (let y = priorTop - 2; y <= priorTop + 1; y++) {
        const score = horizontalScore(left, right, y);
        if (score > topScore) { topScore = score; rowTop = y; }
      }
      for (let y = priorBottom - 2; y <= priorBottom + 1; y++) {
        const score = horizontalScore(left, right, y);
        if (score > bottomScore) { bottomScore = score; rowBottom = y; }
      }
    }
    const cropTop = Math.max(0, Math.round(rowTop + 4));
    const cropHeight = Math.min(
      Math.max(10, Math.round(rowBottom - rowTop - 7)),
      info.height - cropTop,
    );
    if (cropHeight <= 0) break;
    let inkMin = right;
    let inkMax = left - 1;
    for (let y = cropTop; y < Math.min(info.height, cropTop + cropHeight); y++) {
      for (let x = left; x < right; x++) {
        if (data[y * info.width + x] < 95) { inkMin = Math.min(inkMin, x); inkMax = Math.max(inkMax, x); }
      }
    }
    const inkWidth = inkMax >= inkMin ? inkMax - inkMin + 1 : 0;
    const cell = await sharp(data, { raw: info })
      .extract({ left, top: cropTop, width: right - left, height: cropHeight })
      .resize({ width: 180, height: 90, fit: "fill" })
      .threshold(125)
      .extend({ top: 40, bottom: 40, left: 40, right: 40, background: "white" })
      .png().toBuffer();
    let recognized = await worker.recognize(cell, { rotateAuto: false });
    let code = cellCode(recognized.data.text.trim(), inkWidth);
    if (!code) {
      for (const threshold of [105, 150]) {
        const alternate = await sharp(data, { raw: info })
          .extract({ left, top: cropTop, width: right - left, height: cropHeight })
          .resize({ width: 180, height: 90, fit: "fill" }).threshold(threshold)
          .extend({ top: 40, bottom: 40, left: 40, right: 40, background: "white" }).png().toBuffer();
        recognized = await worker.recognize(alternate, { rotateAuto: false });
        code = cellCode(recognized.data.text.trim(), inkWidth);
        if (code) break;
      }
    }
    if (code) numbered.push(`${day + 1}: ${code}`);
    codes.push(code || "?");
    confidences.push(code ? (recognized.data.confidence >= 45 ? 0.95 : 0.88) : 0);
  }
  if (numbered.length < 18) return undefined;
  return { text: numbered.join("\n"), confidences, codes };
}

async function focusedJmTable(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Buffer,
  tsv: string | null,
  staffName: string,
) {
  const words = tsvWords(tsv);
  const complex = words.filter((word) => /complex/i.test(word.text)).sort((a, b) => a.top - b.top)[0];
  if (!complex) return undefined;
  const metadata = await sharp(image).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) return undefined;
  const top = Math.max(0, complex.top - Math.max(60, complex.height * 3));
  const sectionHeight = Math.min(height - top, Math.max(210, Math.round(width * 0.29)));
  const targetWidth = Math.min(2400, Math.max(1800, Math.round(width * 2.5)));
  const section = await sharp(image)
    .extract({ left: 0, top, width, height: sectionHeight })
    .resize({ width: targetWidth })
    .grayscale().normalize().sharpen({ sigma: 1.1 }).png().toBuffer();
  const recognized = await recognize(worker, section, PSM.SPARSE_TEXT);
  return tableRowText(worker, section, recognized.tsv, staffName, 0.4);
}

async function enlargedTable(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Buffer,
  staffName: string,
) {
  const enlarged = await sharp(image).rotate().resize({ width: 1800 }).flatten({ background: "white" }).grayscale().normalize()
    .sharpen({ sigma: 1.1 }).png().toBuffer();
  const recognized = await recognize(worker, enlarged, PSM.SPARSE_TEXT);
  return tableRowText(worker, enlarged, recognized.tsv, staffName);
}

async function imageText(bytes: Buffer, staffName: string, fileName: string) {
  const worker = await createWorker("eng");
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void worker.terminate();
  }, OCR_TIMEOUT_MS);
  try {
    const [primary, highContrast] = await enhancedImages(bytes);
    const first = await recognize(worker, primary, PSM.SPARSE_TEXT);
    const metadata = await sharp(primary).metadata();
    const date = headingDate(first.tsv, metadata.height || 0) || filenameDate(fileName);
    const table = staffName
      ? await tableRowText(worker, primary, first.tsv, staffName)
        || await focusedJmTable(worker, primary, first.tsv, staffName)
        || await enlargedTable(worker, bytes, staffName)
      : undefined;
    const dateLine = date ? `\nROTA_DATE: ${date.name} ${date.year}` : "";
    if (table) return { text: `${first.text}${dateLine}\n${table.text}`, confidences: table.confidences, codes: table.codes };
    if (staffName) throw new Error(`The row for ${staffName} was not read reliably. Crop around JM COMPLEX and retry.`);
    if (ocrQuality(first.text) >= 0.64) return { text: `${first.text}${dateLine}` };

    // High contrast is only attempted when the normalised scan is weak.
    const second = await recognize(worker, highContrast, PSM.SINGLE_BLOCK);
    return { text: ocrQuality(second.text) > ocrQuality(first.text) ? second.text : first.text };
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
    let cellConfidences: number[] | undefined;
    let cellCodes: string[] | undefined;
    const staffName = String(form.get("staffName") || "").trim().slice(0, 80);
    const clientOcrText = String(form.get("clientOcrText") || "").trim().slice(0, 120_000);
    if (clientOcrText) {
      text = clientOcrText;
    } else if (f.type === "application/pdf") {
      text = await pdfText(new Uint8Array(bytes));
      if (text.trim().length < 12)
        return NextResponse.json(
          { error: "This PDF is image-only. Export its rota page as a clear JPG/PNG and upload it." },
          { status: 422 },
        );
    } else if (/^image\/(png|jpeg|webp)$/.test(f.type)) {
      const imageResult = await imageText(bytes, staffName, f.name);
      text = imageResult.text;
      cellConfidences = imageResult.confidences;
      cellCodes = imageResult.codes;
    } else {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
    }

    if (text.trim().length < 12)
      return NextResponse.json(
        { error: "No reliable text was found. Crop to the rota table, keep it straight, and retry." },
        { status: 422 },
      );

    const result = validateAndAnchor(parseRotaText(text, staffName ? { staffName } : {}));
    if (cellConfidences) {
      result.schedule = result.schedule.map((day, index) => ({
        ...(cellCodes?.[index] && cellCodes[index] !== "?"
          ? { ...normalizeDay(day.day, cellCodes[index], cellConfidences![index]), day_of_week: weekday(result.metadata.detected_year, result.metadata.detected_month, day.day) }
          : day),
        confidence: cellConfidences![index] ?? day.confidence,
        is_ambiguous: (cellConfidences![index] ?? day.confidence) < 0.92 || day.normalized_type === "CUSTOM",
      }));
      const uncertain = result.schedule.filter((day) => day.is_ambiguous).map((day) => day.day);
      result.warnings = uncertain.length ? [`Please confirm days ${uncertain.join(", ")} in Inspector.`] : [];
    }
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
