import test from "node:test";
import assert from "node:assert/strict";
import { deterministicUid, diffSchedules, generateCalendar } from "../lib/ics-generator";
import { normalizeDay } from "../lib/shift-definitions";
import { validateAndAnchor, weekday } from "../lib/date-validator";
import { ocrQuality, parseRotaText } from "../lib/ocr/rota-parser";
import type { FeedRecord } from "../types/rota";
const day = (n: number, c: string) => ({ ...normalizeDay(n, c), day_of_week: weekday(2026, 9, n) });
const feed = (schedule = [day(1, "M"), day(2, "N")], previousSchedule?: ReturnType<typeof day>[]): FeedRecord => ({
  token:"a".repeat(40), profile:{id:"me",nurseId:"nur-1",staffName:"Test Nurse",wardUnit:"ICU",timezone:"Asia/Kolkata",reminderMinutes:90,includeLeave:true,includeOff:false},
  revision:{key:"nur-1:2026-09",nurseId:"nur-1",year:2026,month:9,sequence:2,updatedAt:"2026-09-05T00:00:00Z",schedule}, previousSchedule, updatedAt:"2026-09-05T00:00:00Z",
});
test("UID is stable and date anchored", () => assert.equal(deterministicUid("nur-1",2026,9,1),"rota-nur-1-2026-09-01@rotapro.app"));
test("night shift rolls to next date and sequence is emitted", () => { const ics=generateCalendar(feed()); assert.match(ics,/UID:rota-nur-1-2026-09-02@rotapro\.app/); assert.match(ics,/DTSTART;TZID=Asia\/Kolkata:20260902T203000/); assert.match(ics,/DTEND;TZID=Asia\/Kolkata:20260903T080000/); assert.match(ics,/SEQUENCE:2/); });
test("working shift changed to OFF emits cancellation", () => assert.match(generateCalendar(feed([day(1,"OFF")],[day(1,"M")])),/UID:rota-nur-1-2026-09-01@rotapro\.app[\s\S]*STATUS:CANCELLED/));
test("diff detects cancellation", () => assert.equal(diffSchedules([day(1,"N")],[day(1,"OFF")])[0].kind,"CANCELLED"));
test("leap month anchors 29 days", () => assert.equal(validateAndAnchor({metadata:{detected_month:2,detected_year:2028,staff_name:"A",total_days:1},schedule:[day(1,"M")]}).schedule.length,29));
test("table parser chooses the complete staff row and fixes common OCR errors", () => {
  const codes=Array.from({length:30},(_,i)=>i%5===0?"0FF":i%4===0?"M+E":i%3===0?"N":"M");
  const parsed=parseRotaText(`SEPTEMBER 2026\nName: Subha\nSubha ${codes.join(" ")}\nLegend M E N OFF`);
  assert.equal(parsed.schedule.length,30); assert.equal(parsed.schedule[0].raw_code,"OFF"); assert.equal(parsed.schedule[4].raw_code,"M+E"); assert.equal(parsed.schedule[29].raw_code,"M");
});
test("numeric rota date and SO rest-day code are supported", () => {
  const parsed=parseRotaText(`01/10/2026\nNurse A ${Array(31).fill("SO").join(" ")}`);
  assert.equal(parsed.metadata.detected_month,10); assert.equal(parsed.schedule[30].raw_code,"OFF");
});
test("OCR quality rewards rota structure", () => assert.ok(ocrQuality(`September 2026 ${Array(28).fill("M").join(" ")}`) > 0.9));
test("parser recovers shift cells joined together by table OCR", () => {
  const joined = "MENOFFMENOFFMENOFFMENOFFMENOFFMENOFFMENOFFME";
  const parsed = parseRotaText(`SEPTEMBER 2026\nSUBHAJIT ${joined}`, { staffName: "Subhajit" });
  assert.equal(parsed.schedule.filter((item) => item.raw_code !== "?").length, 30);
  assert.deepEqual(parsed.schedule.slice(0, 4).map((item) => item.raw_code), ["M", "E", "N", "OFF"]);
});
test("camera-noisy year and night-off cells are recovered", () => {
  const parsed = parseRotaText(`DUTY ROTA MONTH SEPTEMBER 12026\n1: E\n2: M\n3: OFF\n4: N/O`, { staffName: "Subhajith" });
  assert.equal(parsed.metadata.detected_year, 2026);
  assert.equal(parsed.schedule[3].raw_code, "OFF");
});
