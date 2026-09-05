import { jsPDF } from "jspdf";
import type { RotaMetadata, ScheduleDay } from "@/types/rota";
import { shiftFor } from "./shift-definitions";

export async function downloadRotaPdf(
  metadata: RotaMetadata,
  schedule: ScheduleDay[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const month = new Intl.DateTimeFormat("en", { month: "long" }).format(
    new Date(metadata.detected_year, metadata.detected_month - 1),
  );
  const hours = schedule.reduce(
    (sum, day) => sum + shiftFor(day.raw_code).hours,
    0,
  );
  const nights = schedule.filter(
    (day) => day.normalized_type === "NIGHT",
  ).length;
  doc.setFillColor(8, 25, 34);
  doc.rect(0, 0, 210, 42, "F");
  doc.setTextColor(45, 212, 191);
  doc.setFontSize(11);
  doc.text("ROTAPRO ENTERPRISE", 14, 14);
  doc.setTextColor(245, 250, 250);
  doc.setFontSize(21);
  doc.text(`${month} ${metadata.detected_year} Duty Rota`, 14, 27);
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 204);
  doc.text(
    `${metadata.staff_name}  |  ${metadata.staff_id || "No staff ID"}  |  ${metadata.ward_unit || "Unit not specified"}`,
    14,
    36,
  );
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`Total duty: ${hours.toFixed(1)} hours`, 14, 52);
  doc.text(`Night shifts: ${nights}`, 78, 52);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 125, 52);
  let y = 63;
  const columns = [14, 34, 65, 105, 148];
  const header = ["Day", "Date", "Shift", "Time", "Confidence"];
  doc.setFillColor(226, 245, 243);
  doc.rect(12, y - 5, 186, 9, "F");
  doc.setFont("helvetica", "bold");
  header.forEach((value, index) => doc.text(value, columns[index], y));
  y += 8;
  doc.setFont("helvetica", "normal");
  for (const day of schedule) {
    if (y > 282) {
      doc.addPage();
      y = 18;
    }
    const def = shiftFor(day.raw_code);
    const date = `${String(day.day).padStart(2, "0")}/${String(metadata.detected_month).padStart(2, "0")}/${metadata.detected_year}`;
    const timing = def.start
      ? `${def.start}–${def.end}${def.overnight ? " +1" : ""}`
      : def.calendar === "all-day"
        ? "All day"
        : "—";
    if (day.is_ambiguous) {
      doc.setFillColor(255, 248, 220);
      doc.rect(12, y - 5, 186, 8, "F");
    }
    doc.setTextColor(30, 41, 59);
    [
      String(day.day),
      `${date} ${day.day_of_week}`,
      `${day.raw_code} · ${def.label}`,
      timing,
      `${Math.round(day.confidence * 100)}%`,
    ].forEach((value, index) => doc.text(value, columns[index], y));
    y += 8;
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Verify all amber/low-confidence shifts before clinical use. This report contains only the selected staff row.",
    14,
    292,
  );
  doc.save(
    `rotapro-${metadata.detected_year}-${String(metadata.detected_month).padStart(2, "0")}.pdf`,
  );
}
