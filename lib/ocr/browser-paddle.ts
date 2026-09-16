const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const CODES = ["M+E", "E+N", "M+N", "N/O", "C/O", "OFF", "JMM", "GH", "CL", "SL", "EL", "M", "E", "N", "G"];

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

function normalizeCode(value: string) {
  const token = value.toUpperCase().replace(/[^A-Z0-9/+]/g, "").replace(/^0FF$/, "OFF");
  if (CODES.includes(token)) return token === "JMM" ? "M" : token;
  if (/^O?FF$/.test(token)) return "OFF";
  if (/^[|I1]?M[M]?$/.test(token)) return "M";
  if (/^[|I1]?N[N]?$/.test(token)) return "N";
  if (/^[|I1]?E[E]?$/.test(token)) return "E";
  return "";
}

function codesFromText(value: string) {
  const direct = normalizeCode(value);
  if (direct) return [direct];
  const compact = value.toUpperCase().replace(/[^A-Z0-9/+]/g, "");
  return (compact.match(/M\+E|E\+N|M\+N|N\/O|C\/O|OFF|JMM|GH|CL|SL|EL|M|E|N|G/g) ?? [])
    .map(normalizeCode)
    .filter(Boolean);
}

function bestCodeLine<T extends { text: string; confidence: number; box: { y: number; height: number; x: number; width: number } }>(items: T[]) {
  const ordered = [...items].sort((a, b) =>
    (a.box.y + a.box.height / 2) - (b.box.y + b.box.height / 2) || a.box.x - b.box.x,
  );
  const lines: T[][] = [];
  for (const item of ordered) {
    const center = item.box.y + item.box.height / 2;
    const line = lines.find((candidate) => {
      const anchor = candidate[0];
      const anchorCenter = anchor.box.y + anchor.box.height / 2;
      return Math.abs(center - anchorCenter) <= Math.max(item.box.height, anchor.box.height) * 0.6;
    });
    if (line) line.push(item);
    else lines.push([item]);
  }
  const candidates = lines.map((line) => line.flatMap((item) => {
    const codes = codesFromText(item.text);
    return codes.map((code, index) => ({
      code,
      confidence: item.confidence,
      x: item.box.x + item.box.width * ((index + 0.5) / codes.length),
    }));
  })).sort((a, b) => Math.abs(30 - a.length) - Math.abs(30 - b.length));
  let best = candidates[0] ?? [];
  if (best.length > 31 && best.length <= 35) {
    const ordered = [...best].sort((a, b) => a.x - b.x);
    let gridBest: typeof best = [];
    let gridScore = -Infinity;
    for (let left = 0; left < Math.min(5, ordered.length); left++) {
      for (let right = Math.max(left + 29, ordered.length - 5); right < ordered.length; right++) {
        const step = (ordered[right].x - ordered[left].x) / 29;
        if (step <= 0) continue;
        const slots: Array<(typeof ordered)[number] | undefined> = Array(30);
        let residual = 0;
        for (const token of ordered) {
          const slot = Math.round((token.x - ordered[left].x) / step);
          if (slot < 0 || slot >= 30) continue;
          const distance = Math.abs(token.x - (ordered[left].x + slot * step));
          if (distance > step * 0.48) continue;
          const current = slots[slot];
          if (!current || token.confidence > current.confidence) slots[slot] = token;
          residual += distance / step;
        }
        const selected = slots.filter((token): token is (typeof ordered)[number] => Boolean(token));
        const score = selected.length * 100 + selected.reduce((sum, token) => sum + token.confidence, 0) - residual;
        if (score > gridScore) {
          gridScore = score;
          gridBest = selected;
        }
      }
    }
    if (gridBest.length === 30) {
      best = gridBest;
    } else {
      best = [...best]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 30);
    }
  }
  return best.sort((a, b) => a.x - b.x).map((token) => token.code);
}

function filenameDate(name: string) {
  const match = name.match(/(20\d{2})(0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : "";
}

export async function paddleRotaText(file: File, staffName: string) {
  const { ocr, V5_EN_MOBILE_MODEL, V6_SMALL_MODEL } = await import("ppu-paddle-ocr/web");
  const bytes = await file.arrayBuffer();
  let result = await ocr(bytes, { model: V5_EN_MOBILE_MODEL, flatten: true });
  const wanted = staffName.toUpperCase().replace(/[^A-Z]/g, "");
  const findTarget = (maximumX = Infinity) => {
    const ordered = [...result.results].sort((a, b) => a.box.x - b.box.x);
    const joined = ordered.flatMap((item, index) => {
      const sameRow = ordered.slice(index + 1).filter((next) => {
        const center = item.box.y + item.box.height / 2;
        const nextCenter = next.box.y + next.box.height / 2;
        const gap = next.box.x - (item.box.x + item.box.width);
        return Math.abs(center - nextCenter) <= Math.max(item.box.height, next.box.height) * 0.7 &&
          gap >= 0 && gap <= Math.max(item.box.height, next.box.height) * 5;
      }).slice(0, 2);
      const candidates = [item];
      let text = item.text;
      let right = item.box.x + item.box.width;
      for (const next of sameRow) {
        text += next.text;
        right = Math.max(right, next.box.x + next.box.width);
        candidates.push({
          ...item,
          text,
          confidence: Math.min(item.confidence, next.confidence),
          box: { ...item.box, width: right - item.box.x },
        });
      }
      return candidates;
    });
    return joined.filter((item) => item.box.x < maximumX).map((item) => {
      const seen = item.text.toUpperCase().replace(/[^A-Z]/g, "");
      const similarity = seen && wanted ? 1 - editDistance(seen, wanted) / Math.max(seen.length, wanted.length) : 0;
      return { item, similarity };
    }).sort((a, b) => b.similarity - a.similarity)[0];
  };
  let target = findTarget();
  let pageSource: CanvasImageSource | null = null;
  let pageWidth = 0;
  let pageHeight = 0;
  let sourceBitmap: ImageBitmap | null = null;
  let forceRowCrop = false;

  if (!target || target.similarity < 0.45) {
    sourceBitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
    const pageCanvas = document.createElement("canvas");
    const pageScale = Math.min(2.25, 3000 / sourceBitmap.width);
    pageCanvas.width = Math.round(sourceBitmap.width * pageScale);
    pageCanvas.height = Math.round(sourceBitmap.height * pageScale);
    const pageContext = pageCanvas.getContext("2d");
    if (!pageContext) throw new Error("Could not enlarge the rota page.");
    pageContext.imageSmoothingEnabled = true;
    pageContext.imageSmoothingQuality = "high";
    pageContext.drawImage(sourceBitmap, 0, 0, pageCanvas.width, pageCanvas.height);
    pageSource = pageCanvas;
    pageWidth = pageCanvas.width;
    pageHeight = pageCanvas.height;

    // Names occupy only a small fraction of a full photographed worksheet.
    // Scan that column first with the fast mobile model. If it finds the
    // requested employee, we can skip an expensive full-page V6 pass and go
    // straight to the high-resolution duty-row crop.
    const initialResult = result;
    const nameColumnWidth = Math.round(pageWidth * 0.42);
    const nameScale = Math.min(2, Math.max(1.5, 2100 / nameColumnWidth));
    const nameCanvas = document.createElement("canvas");
    nameCanvas.width = Math.round(nameColumnWidth * nameScale);
    nameCanvas.height = Math.round(pageHeight * nameScale);
    const nameContext = nameCanvas.getContext("2d");
    if (!nameContext) throw new Error("Could not enlarge the rota staff column.");
    nameContext.imageSmoothingEnabled = true;
    nameContext.imageSmoothingQuality = "high";
    nameContext.drawImage(pageCanvas, 0, 0, nameColumnWidth, pageHeight, 0, 0, nameCanvas.width, nameCanvas.height);
    result = await ocr(nameCanvas, { model: V5_EN_MOBILE_MODEL, flatten: true });
    const focusedTarget = findTarget();
    result = initialResult;
    if (focusedTarget && focusedTarget.similarity >= 0.45) {
      forceRowCrop = true;
      target = {
        similarity: focusedTarget.similarity,
        item: {
          ...focusedTarget.item,
          box: {
            x: focusedTarget.item.box.x / nameScale,
            y: focusedTarget.item.box.y / nameScale,
            width: focusedTarget.item.box.width / nameScale,
            height: focusedTarget.item.box.height / nameScale,
          },
        },
      };
    }

    if (!target || target.similarity < 0.45) {
      result = await ocr(pageCanvas, { model: V6_SMALL_MODEL, flatten: true });
      target = findTarget();
    }
    if (!target || target.similarity < 0.45) {
      target = findTarget(pageWidth * 0.38);
      const structural = result.results
        .filter((item) => item.box.x < pageWidth * 0.38 && item.text.replace(/[^A-Za-z]/g, "").length >= 3)
        .map((item) => {
          const seen = item.text.toUpperCase().replace(/[^A-Z]/g, "");
          const similarity = seen ? 1 - editDistance(seen, wanted) / Math.max(seen.length, wanted.length) : 0;
          const center = item.box.y + item.box.height / 2;
          const row = result.results.filter((other) => {
            const otherCenter = other.box.y + other.box.height / 2;
            return other.box.x > item.box.x + item.box.width &&
              Math.abs(otherCenter - center) <= Math.max(item.box.height, other.box.height) * 0.8;
          });
          const dutyCount = bestCodeLine(row).length;
          return { item, similarity, dutyCount, score: similarity * 20 - Math.abs(30 - dutyCount) };
        })
        .filter((candidate) => candidate.dutyCount >= 20)
        .sort((a, b) => b.score - a.score)[0];
      if (structural && (!target || structural.score > target.similarity * 20 - 22)) {
        target = { item: structural.item, similarity: Math.max(0.15, structural.similarity) };
      }
    }
  }
  const leftColumnFallback = Boolean(target && pageWidth > 0 &&
    target.item.box.x < pageWidth * 0.38 && target.similarity >= 0.15);
  if (!target || (target.similarity < 0.45 && !leftColumnFallback)) {
    throw new Error("Named row was not found by local OCR.");
  }

  const centerY = target.item.box.y + target.item.box.height / 2;
  let rowItems = result.results
    .filter((item) => {
      const itemY = item.box.y + item.box.height / 2;
      return item.box.x > target.item.box.x + target.item.box.width &&
        Math.abs(itemY - centerY) <= Math.max(target.item.box.height, item.box.height) * 0.55;
    })
    .sort((a, b) => a.box.x - b.box.x);

  let codes = bestCodeLine(rowItems);

  // A complete photographed sheet makes each duty cell only a few pixels
  // high. Once the full-page pass has located the requested nurse, enlarge
  // that row and recognize it again. This is both faster and substantially
  // more accurate than sending the whole staff sheet through a second engine.
  if (forceRowCrop || codes.length < 28 || codes.length > 31) {
    if (!pageSource) {
      sourceBitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
      pageSource = sourceBitmap;
      pageWidth = sourceBitmap.width;
      pageHeight = sourceBitmap.height;
    }
    // Keep the crop inside the detected row. A wider band admits characters
    // from the nurse immediately above/below and can shift otherwise correct
    // cells into neighbouring day columns on dense Excel photographs.
    const rowHeight = Math.max(target.item.box.height * 1.35, 8);
    const sourceY = Math.max(0, centerY - rowHeight / 2);
    // Joined OCR boxes can accidentally extend from the employee name through
    // the ID column and into the first duty cells. Never let that fuzzy box
    // push the crop past the usual left edge of the day grid.
    const sourceX = Math.max(0, Math.min(target.item.box.x + target.item.box.width, pageWidth * 0.19));
    const sourceWidth = pageWidth - sourceX;
    const sourceHeight = Math.min(rowHeight, pageHeight - sourceY);
    const scale = Math.min(8, Math.max(2, 120 / sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(6000, Math.round(sourceWidth * scale));
    canvas.height = Math.round(sourceHeight * (canvas.width / sourceWidth));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the named rota row.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(pageSource, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    sourceBitmap?.close();

    const rowResult = await ocr(canvas, { model: V6_SMALL_MODEL, flatten: true });
    rowItems = rowResult.results.sort((a, b) => a.box.x - b.box.x);
    codes = bestCodeLine(rowItems);
  }
  if (codes.length < 28 || codes.length > 31) throw new Error(`Local OCR found ${codes.length} duty cells instead of 28–31.`);

  let heading = result.text;
  // OCR frequently splits the worksheet title into several boxes (for
  // example, "SEPTEMBER" and "2026"). Reconstruct visual lines before
  // choosing the date, and penalize the tiny Excel window caption at the very
  // top of a monitor photograph so it cannot override the larger sheet title.
  const headingLines: Array<typeof result.results> = [];
  for (const item of [...result.results].sort((a, b) =>
    (a.box.y + a.box.height / 2) - (b.box.y + b.box.height / 2) || a.box.x - b.box.x,
  )) {
    const center = item.box.y + item.box.height / 2;
    const line = headingLines.find((candidate) => {
      const anchor = candidate[0];
      return Math.abs(center - (anchor.box.y + anchor.box.height / 2)) <= Math.max(item.box.height, anchor.box.height) * 0.75;
    });
    if (line) line.push(item);
    else headingLines.push([item]);
  }
  const observedHeight = Math.max(...result.results.map((item) => item.box.y + item.box.height), 1);
  const datePattern = new RegExp(`(${MONTHS.join("|")})\\s*[-/]?\\s*(20\\d{2})`, "i");
  const reconstructedHeading = headingLines
    .map((line) => {
      const ordered = [...line].sort((a, b) => a.box.x - b.box.x);
      const text = ordered.map((item) => item.text).join(" ").replace(/\s+/g, " ");
      const center = ordered.reduce((sum, item) => sum + item.box.y + item.box.height / 2, 0) / ordered.length;
      const height = Math.max(...ordered.map((item) => item.box.height));
      const upper = text.toUpperCase();
      const score = height + (/MONTH/.test(upper) ? 40 : 0) + (/DUTY|ROTA/.test(upper) ? 20 : 0) - (center < observedHeight * 0.06 ? 60 : 0);
      return { text, score };
    })
    .filter((line) => datePattern.test(line.text))
    .sort((a, b) => b.score - a.score)[0];
  const datedHeadings = result.results
    .filter((item) => MONTHS.some((month) => item.text.toLowerCase().includes(month)) && /20\d{2}/.test(item.text))
    .sort((a, b) => b.box.height - a.box.height);
  const sheetHeading = (reconstructedHeading?.text ?? datedHeadings[0]?.text ?? "").match(datePattern);
  if (sheetHeading) {
    heading += `\nROTA_DATE: ${sheetHeading[1]} ${sheetHeading[2]}`;
  } else {
    const fallback = filenameDate(file.name);
    if (fallback) heading += `\nROTA_DATE: ${fallback}`;
  }
  return `${heading}\n${codes.map((code, index) => `${index + 1}: ${code}`).join("\n")}`;
}
