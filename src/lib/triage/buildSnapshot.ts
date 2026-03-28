import type { TriageItem, TriageSnapshot } from "../model/triage";
import { ghRest, ghGraphQL } from "../gh/ghClient";
import {
  SEARCH_REVIEW_REQUESTED,
  SEARCH_ASSIGNED,
  buildPrDetailQuery,
  type GitHubNotification,
  type SearchResult,
  type PrDetailResult,
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
        if (item.author && !existing.author) {
          existing.author = item.author;
          existing.avatarUrl = item.avatarUrl;
        }
        if (item.isDraft) existing.isDraft = true;
      } else {
        byId.set(item.id, { ...item });
      }
    }
  }

  return [...byId.values()];
}

async function enrichNotifPrs(items: TriageItem[]): Promise<void> {
  const prs = items.filter((item) => item.kind === "pr");
  if (prs.length === 0) return;

  const query = buildPrDetailQuery(prs.map((p) => ({ repo: p.repo, number: p.number })));

  try {
    const result = await ghGraphQL<PrDetailResult>(query);
    for (let i = 0; i < prs.length; i++) {
      const data = result.data[`pr${i}`]?.pullRequest;
      if (!data) continue;

      const pr = prs[i];
      if (data.state === "MERGED") pr.state = "merged";
      else if (data.state === "CLOSED") pr.state = "closed";

      pr.isDraft = data.isDraft;

      if (data.author && !pr.author) {
        pr.author = data.author.login;
        pr.avatarUrl = data.author.avatarUrl;
      }
    }
  } catch {
    // fall through — items keep default state
  }
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

  await enrichNotifPrs(notifItems);

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
