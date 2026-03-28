import type { TriageItem, TriageSnapshot } from "../model/triage";
import { ghRest, ghGraphQL } from "../gh/ghClient";
import {
  SEARCH_REVIEW_REQUESTED,
  SEARCH_ASSIGNED,
  type GitHubNotification,
  type SearchResult,
} from "../gh/queries";
import { mapNotification, mapSearchNode } from "../gh/mappers";
import { scoreAndSort } from "./scoring";
import { getWatchedRepoSet } from "../storage/local";

function mergeItems(sources: TriageItem[][]): TriageItem[] {
  const byId = new Map<string, TriageItem>();

  for (const items of sources) {
    for (const item of items) {
      const existing = byId.get(item.id);
      if (existing) {
        const reasonSet = new Set([...existing.reasons, ...item.reasons]);
        existing.reasons = [...reasonSet];
        if (item.threadId && !existing.threadId) {
          existing.threadId = item.threadId;
        }
      } else {
        byId.set(item.id, { ...item });
      }
    }
  }

  return [...byId.values()];
}

export async function buildSnapshot(): Promise<TriageSnapshot> {
  const watchedRepos = await getWatchedRepoSet();
  const hasFilter = watchedRepos.size > 0;

  const [notifications, reviewRequested, assigned] = await Promise.all([
    ghRest<GitHubNotification[]>("notifications?per_page=50").catch(() => []),
    ghGraphQL<SearchResult>(SEARCH_REVIEW_REQUESTED).catch(() => null),
    ghGraphQL<SearchResult>(SEARCH_ASSIGNED).catch(() => null),
  ]);

  const notifItems = notifications
    .map(mapNotification)
    .filter((item): item is TriageItem => item !== null);

  const reviewItems = reviewRequested?.data.search.nodes.map((n) => mapSearchNode(n, "review")) ?? [];
  const assignedItems = assigned?.data.search.nodes.map((n) => mapSearchNode(n, "assigned")) ?? [];

  let merged = mergeItems([notifItems, reviewItems, assignedItems]);

  if (hasFilter) {
    merged = merged.filter((item) => watchedRepos.has(item.repo.toLowerCase()));
  }

  merged = merged.filter((item) => item.state === "open");
  const scored = scoreAndSort(merged);

  return {
    items: scored,
    fetchedAt: Date.now(),
  };
}
