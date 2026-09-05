import { promises as fs } from "fs";
import path from "path";
import type { FeedRecord } from "@/types/rota";
const DIR = path.join(process.cwd(), "data", "feeds");
async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}
function fileFor(token: string) {
  const safe = token.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe.length < 6) throw new Error("Invalid token");
  return path.join(DIR, `${safe}.json`);
}
export async function putFeed(record: FeedRecord) {
  await ensureDir();
  await fs.writeFile(fileFor(record.token), JSON.stringify(record), "utf8");
}
export async function getFeed(token: string): Promise<FeedRecord | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(token), "utf8")) as FeedRecord;
  } catch {
    return null;
  }
}
