"use client";
import { openDB, type DBSchema } from "idb";
import type { RotaProfile, RotaRevision } from "@/types/rota";
interface RotaDB extends DBSchema {
  profiles: { key: string; value: RotaProfile };
  revisions: {
    key: string;
    value: RotaRevision;
    indexes: { "by-month": [string, number, number] };
  };
  drafts: { key: string; value: unknown };
}
const db = () =>
  openDB<RotaDB>("rotapro-enterprise", 1, {
    upgrade(x) {
      const p = x.createObjectStore("profiles", { keyPath: "id" });
      void p;
      const r = x.createObjectStore("revisions", { keyPath: "key" });
      r.createIndex("by-month", ["nurseId", "year", "month"]);
      x.createObjectStore("drafts");
    },
  });
export const rotaKey = (n: string, y: number, m: number) =>
  `${n}:${y}-${String(m).padStart(2, "0")}`;
export async function saveProfile(v: RotaProfile) {
  return (await db()).put("profiles", v);
}
export async function getProfile(id = "me") {
  return (await db()).get("profiles", id);
}
export async function saveRevision(v: RotaRevision) {
  return (await db()).put("revisions", v);
}
export async function getRevision(n: string, y: number, m: number) {
  return (await db()).get("revisions", rotaKey(n, y, m));
}
export async function nextRevision(n: string, y: number, m: number) {
  const old = await getRevision(n, y, m);
  return (old?.sequence ?? -1) + 1;
}
