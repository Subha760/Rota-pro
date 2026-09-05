import type { FeedRecord } from "@/types/rota";
import { getFeed as getLocal, putFeed as putLocal } from "./feed-store";
const cfg = () => ({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
export async function putFeed(record: FeedRecord) {
  const { url, key } = cfg();
  if (!url || !key) return putLocal(record);
  const r = await fetch(`${url}/rest/v1/rota_feeds?on_conflict=token`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      token: record.token,
      owner_id: record.profile.id,
      payload: record,
      updated_at: record.updatedAt,
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Feed persistence failed (${r.status})`);
}
export async function getFeed(token: string) {
  const { url, key } = cfg();
  if (!url || !key) return getLocal(token);
  const r = await fetch(
    `${url}/rest/v1/rota_feeds?token=eq.${encodeURIComponent(token)}&select=payload&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  if (!r.ok) return null;
  const rows = (await r.json()) as { payload: FeedRecord }[];
  return rows[0]?.payload ?? null;
}
