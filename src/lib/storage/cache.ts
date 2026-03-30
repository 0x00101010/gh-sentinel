import { Cache } from "@raycast/api";
import type { TriageSnapshot } from "../model/triage";

const cache = new Cache();
const SNAPSHOT_KEY = "triage-snapshot";
const SEEN_IDS_KEY = "seen-notification-ids";
const MAX_SEEN = 500;

export function getCachedSnapshot(): TriageSnapshot | null {
  const raw = cache.get(SNAPSHOT_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as TriageSnapshot;
}

export function setCachedSnapshot(snapshot: TriageSnapshot): void {
  cache.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function getSeenIds(): Set<string> {
  const raw = cache.get(SEEN_IDS_KEY);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

export function addSeenIds(ids: string[]): void {
  const existing = getSeenIds();
  for (const id of ids) {
    existing.add(id);
  }
  const trimmed = [...existing].slice(-MAX_SEEN);
  cache.set(SEEN_IDS_KEY, JSON.stringify(trimmed));
}

export function clearCache(): void {
  cache.remove(SNAPSHOT_KEY);
  cache.remove(SEEN_IDS_KEY);
}
