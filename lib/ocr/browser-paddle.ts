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

function filenameDate(name: string) {
  const match = name.match(/(20\d{2})(0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : "";
}

export async function paddleRotaText(file: File, staffName: string) {
  const { ocr, V5_EN_MOBILE_MODEL } = await import("ppu-paddle-ocr/web");
  const bytes = await file.arrayBuffer();
  const result = await ocr(bytes, { model: V5_EN_MOBILE_MODEL, flatten: true });
  const wanted = staffName.toUpperCase().replace(/[^A-Z]/g, "");
  const names = result.results.map((item) => {
    const seen = item.text.toUpperCase().replace(/[^A-Z]/g, "");
    const similarity = seen && wanted ? 1 - editDistance(seen, wanted) / Math.max(seen.length, wanted.length) : 0;
    return { item, similarity };
  }).sort((a, b) => b.similarity - a.similarity);
  const target = names[0];
  if (!target || target.similarity < 0.45) throw new Error("Named row was not found by local OCR.");

  const centerY = target.item.box.y + target.item.box.height / 2;
  let rowItems = result.results
    .filter((item) => {
      const itemY = item.box.y + item.box.height / 2;
      return item.box.x > target.item.box.x + target.item.box.width &&
        Math.abs(itemY - centerY) <= Math.max(target.item.box.height, item.box.height) * 0.75;
    })
    .sort((a, b) => a.box.x - b.box.x);

  let codes = rowItems.flatMap((item) => {
    const direct = normalizeCode(item.text);
    if (direct) return [direct];
    return item.text.split(/\s+/).map(normalizeCode).filter(Boolean);
  });

  // A complete photographed sheet makes each duty cell only a few pixels
  // high. Once the full-page pass has located the requested nurse, enlarge
  // that row and recognize it again. This is both faster and substantially
  // more accurate than sending the whole staff sheet through a second engine.
  if (codes.length < 28 || codes.length > 31) {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
    const rowHeight = Math.max(target.item.box.height * 2.4, 18);
    const sourceY = Math.max(0, centerY - rowHeight / 2);
    const sourceX = Math.max(0, target.item.box.x + target.item.box.width);
    const sourceWidth = bitmap.width - sourceX;
    const sourceHeight = Math.min(rowHeight, bitmap.height - sourceY);
    const scale = Math.min(8, Math.max(2, 120 / sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(6000, Math.round(sourceWidth * scale));
    canvas.height = Math.round(sourceHeight * (canvas.width / sourceWidth));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the named rota row.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const rowResult = await ocr(canvas, { model: V5_EN_MOBILE_MODEL, flatten: true });
    rowItems = rowResult.results.sort((a, b) => a.box.x - b.box.x);
    codes = rowItems.flatMap((item) => {
      const direct = normalizeCode(item.text);
      if (direct) return [direct];
      return item.text.split(/\s+/).map(normalizeCode).filter(Boolean);
    });
  }
  if (codes.length < 28 || codes.length > 31) throw new Error(`Local OCR found ${codes.length} duty cells instead of 28–31.`);

  let heading = result.text;
  const hasMonth = MONTHS.some((month) => heading.toLowerCase().includes(month));
  if (!hasMonth || !/20\d{2}/.test(heading)) {
    const fallback = filenameDate(file.name);
    if (fallback) heading += `\nROTA_DATE: ${fallback}`;
  }
  return `${heading}\n${codes.map((code, index) => `${index + 1}: ${code}`).join("\n")}`;
}
